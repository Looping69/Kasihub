// Author: Klaasvaakie ( |╲ )
const encoreBase = (process.env.PRESALE_E2E_API_URL || "http://127.0.0.1:4001").replace(/\/$/, "");
const appBase = (process.env.PRESALE_E2E_APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const backendOnly = process.argv.includes("--backend-only");

async function requestJson(url, init = {}, label = url) {
  const response = await fetch(url, init);
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) throw new Error(`${label} failed (${response.status}): ${text.slice(0, 500)}`);
  return { response, body };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const setup = (await requestJson(`${encoreBase}/testing/presale/e2e-runs`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "{}",
}, "create E2E run")).body;
assert(setup?.schemaVersion === "presale-e2e-run.v1", "E2E setup contract is invalid");

// Authenticate through the real applicant path, creating a sealed resume credential.
await requestJson(encoreBase+'/presale/members', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
 inviteToken:setup.inviteToken,email:setup.email,password:setup.testPassword,legalName:'End-to-end Investor',phone:'+27820000000',applicantType:'individual',nationality:'South African',countryOfResidence:'South Africa',streetAddress:'1 Test Evidence Street',suburb:'Braamfontein',city:'Johannesburg',postalCode:'2001'
})},'register resumable applicant');
const bearerHeaders = {
  authorization: `Bearer ${setup.sessionToken}`,
  "content-type": "application/json",
};
const offer = (await requestJson(
  `${encoreBase}/presale/offer?inviteToken=${encodeURIComponent(setup.inviteToken)}`,
  {},
  "resolve private offer",
)).body;
assert(offer?.offer?.name === "E2E Private Allocation", "Invitation did not resolve the isolated E2E campaign");

const orderPayload = {
  inviteToken: setup.inviteToken,
  buyerName: "End-to-end Investor",
  buyerEmail: setup.email,
  buyerPhone: "+27820000000",
  quantity: 2,
  paymentRail: "webpay_card",
  termsAccepted: true,
  investorApplication: {
    applicantType: "individual",
    dateOfBirth: "1990-01-01",
    nationality: "South African",
    occupation: "Software engineer",
    employer: "KaSiHub E2E",
    countryOfResidence: "South Africa",
    streetAddress: "1 Test Evidence Street",
    suburb: "Braamfontein",
    city: "Johannesburg",
    postalCode: "2001",
    confirmMobileNumber: "+27820000000",
    taxNumber: "E2E-TAX-ONLY",
    taxResidenceCountry: "South Africa",
    sourceOfFunds: "salary",
    sourceOfFundsDetails: "Synthetic non-production test fixture",
    fundsOwnership: "own",
    bankAccountHolder: "End-to-end Investor",
    bankName: "E2E Test Bank",
    bankBranch: "000000",
    bankAccountNumber: "0000000000",
    bankAccountType: "Cheque",
    amlDeclarationAccepted: true,
    suitabilityDeclarationAccepted: true,
    informationDeclarationAccepted: true,
  },
};
await requestJson(encoreBase+'/presale/applicant/progress',{method:'POST',headers:bearerHeaders,body:JSON.stringify({phaseCompleted:4,draft:{...orderPayload.investorApplication,buyerName:orderPayload.buyerName}})},'save encrypted application');
const freshLogin=(await requestJson(encoreBase+'/presale/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:setup.email,password:setup.testPassword})},'fresh applicant login')).body;
const resumed=(await requestJson(encoreBase+'/presale/applicant/portal',{headers:{authorization:'Bearer '+freshLogin.token}},'restore saved application in fresh session')).body;
assert(resumed.application?.draft?.occupation==='Software engineer' && resumed.application?.phaseCompleted===4,'Saved draft did not survive fresh login');
assert(resumed.continuation?.resumeUrl?.includes('invite='),'Authoritative resume credential was not restored');
const orderResponse = (await requestJson(`${encoreBase}/presale/orders`, {
  method: "POST",
  headers: { ...bearerHeaders, "idempotency-key": `presale-e2e-${setup.runId}` },
  body: JSON.stringify(orderPayload),
}, "create real reservation")).body;
const orderReference = orderResponse?.order?.orderReference;
assert(typeof orderReference === "string", "Reservation did not return an order reference");

const settlementUrl = `${encoreBase}/testing/presale/e2e-runs/${encodeURIComponent(setup.runId)}/settle`;
const firstSettlement = (await requestJson(settlementUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ orderReference }),
}, "settle and issue")).body;
const replaySettlement = (await requestJson(settlementUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ orderReference }),
}, "replay settlement")).body;
assert(firstSettlement?.purchaseId === replaySettlement?.purchaseId, "Settlement replay created a different purchase");
assert(firstSettlement?.certificate?.certificateNumber === replaySettlement?.certificate?.certificateNumber,
  "Settlement replay created a different certificate");
assert(firstSettlement?.delivery?.requestStatus === "processed" && firstSettlement?.delivery?.completionRecorded === true,
  "Durable issuance delivery did not complete");

const portal = (await requestJson(`${encoreBase}/presale/applicant/portal`, {
  headers: { authorization: `Bearer ${setup.sessionToken}` },
}, "read authoritative shareholder portal")).body;
const holding = portal?.shareholder?.holdings?.find((item) => item.orderReference === orderReference);
assert(holding?.status === "issued", "Issued allocation is not visible in the shareholder portal");
assert(holding?.certificate?.certificateNumber === firstSettlement.certificate.certificateNumber,
  "Portal certificate does not match the issuance result");

const directVerification = (await requestJson(
  `${encoreBase}/shares/certificates/verify/${encodeURIComponent(firstSettlement.certificate.verificationId)}`,
  {},
  "verify sealed certificate",
)).body;
assert(directVerification?.verified === true, "Certificate integrity verification failed");

assert(portal.additionalPurchase?.eligible===true,'Issued shareholder cannot start additional purchase');
const additional=(await requestJson(encoreBase+'/presale/applicant/additional-purchase',{method:'POST',headers:bearerHeaders,body:'{}'},'authorize another purchase')).body;
assert(additional.purchaseUrl?.includes('invite='),'Additional purchase URL missing');
const second=(await requestJson(encoreBase+'/presale/orders',{method:'POST',headers:{...bearerHeaders,'idempotency-key':'second-'+setup.runId},body:JSON.stringify({...orderPayload,quantity:1})},'create additional reservation')).body;
assert(second.order.orderReference!==orderReference,'Additional purchase reused prior order');
await requestJson(encoreBase+'/presale/orders/'+second.order.orderReference+'/cancel',{method:'POST',headers:bearerHeaders,body:JSON.stringify({acknowledgeNoPaymentSent:true})},'cancel unpaid additional reservation');
const finalPortal=(await requestJson(encoreBase+'/presale/applicant/portal',{headers:bearerHeaders},'read after cancellation')).body;
assert(finalPortal.shareholder.totalIssuedShares===4,'Cancellation changed issued shares');
let frontend = { checked: false };
if (!backendOnly) {
  const sessionResponse = await requestJson(`${appBase}/api/testing/presale/session`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: appBase },
    body: JSON.stringify({ sessionToken: setup.sessionToken }),
  }, "create development browser session");
  const setCookie = sessionResponse.response.headers.get("set-cookie");
  assert(setCookie, "Development session route did not set the applicant cookie");
  const cookie = setCookie.split(";")[0];
  const bffPortal = (await requestJson(`${appBase}/api/presale/portal`, {
    headers: { cookie },
  }, "read portal through Next BFF")).body;
  const bffHolding = bffPortal?.shareholder?.holdings?.find((item) => item.orderReference === orderReference);
  assert(bffHolding?.certificate?.certificateNumber === firstSettlement.certificate.certificateNumber,
    "Next BFF did not expose the issued certificate");

  const pdfResponse = await fetch(
    `${appBase}/api/presale/certificates/${encodeURIComponent(firstSettlement.certificate.certificateNumber)}`,
    { headers: { cookie } },
  );
  const pdf = new Uint8Array(await pdfResponse.arrayBuffer());
  assert(pdfResponse.ok && pdfResponse.headers.get("content-type") === "application/pdf", "Certificate PDF route failed");
  assert(pdf.length > 1000 && String.fromCharCode(...pdf.slice(0, 5)) === "%PDF-", "Certificate response is not a real PDF");

  const bffVerification = (await requestJson(
    `${appBase}/api/shares/certificates/verify/${encodeURIComponent(firstSettlement.certificate.verificationId)}`,
    {},
    "verify certificate through Next BFF",
  )).body;
  assert(bffVerification?.verified === true, "Next verification route rejected the sealed certificate");
  frontend = { checked: true, pdfBytes: pdf.length };
}

process.stdout.write(`${JSON.stringify({
  ok: true,
  runId: setup.runId,
  orderReference,
  purchaseId: firstSettlement.purchaseId,
  certificateNumber: firstSettlement.certificate.certificateNumber,
  verificationId: firstSettlement.certificate.verificationId,
  totalShares: firstSettlement.certificate.totalShares,
  settlementReplayIdempotent: true,
  outboxProcessed: true,
  portalIssued: true,
  certificateVerified: true,
  genuineSaveResume: true,
  additionalPurchaseAndCancellation: true,
  frontend,
}, null, 2)}\n`);
