// Author: Klaasvaakie ( |╲ )
import { APIError } from "encore.dev/api";
import { createHash } from "node:crypto";
import { sharesDb } from "../../resources";
import { sealPresaleCertificate } from "./certificate-integrity";
import { solidusCertificateNumber } from "./certificate-numbering";

export type IssueSharesCommand = {
  operationId: string;
  source: "presale";
  sourceReference: string;
  profileId: string;
  phaseNumber: number;
  paidShares: number;
  bonusShares: number;
  acquisitionAmount: string;
  issuePricePerPaidShare: string;
  currency: "USD";
  holder: {
    name: string;
    address: string;
    profileNumber: string;
  };
};

export type IssueSharesResult = {
  issued: boolean;
  purchaseId: string;
  certificateId: string;
  certificateNumber: string;
  verificationId: string;
  completionEventId: string;
};

function commandHash(command: IssueSharesCommand): string {
  return createHash("sha256").update(JSON.stringify(command)).digest("hex");
}

function validateCommand(command: IssueSharesCommand): void {
  const totalShares = command.paidShares + command.bonusShares;
  if (!command.operationId.trim() || !command.sourceReference.trim() || !command.profileId.trim()) {
    throw APIError.invalidArgument("Share issuance identity is incomplete");
  }
  if (!Number.isInteger(command.phaseNumber) || command.phaseNumber <= 0
    || !Number.isInteger(command.paidShares) || command.paidShares <= 0
    || !Number.isInteger(command.bonusShares) || command.bonusShares < 0
    || totalShares <= 0) {
    throw APIError.invalidArgument("Share issuance allocation is invalid");
  }
  if (!command.holder.name.trim() || !command.holder.address.trim() || !command.holder.profileNumber.trim()) {
    throw APIError.failedPrecondition("The certificate holder snapshot is incomplete");
  }
  if (!/^\d+(?:\.\d{1,6})?$/.test(command.acquisitionAmount) || Number(command.acquisitionAmount) <= 0) {
    throw APIError.invalidArgument("Share issuance acquisition amount is invalid");
  }
  if (!/^\d+(?:\.\d{1,6})?$/.test(command.issuePricePerPaidShare)
    || Number(command.issuePricePerPaidShare) <= 0) {
    throw APIError.invalidArgument("Share issuance paid share price is invalid");
  }
}

/**
 * The only authority permitted to turn a settled source obligation into a
 * purchase, distinctive range, certificate number and sealed certificate.
 * Every write either commits together or does not exist.
 */
export async function issueShares(command: IssueSharesCommand): Promise<IssueSharesResult> {
  validateCommand(command);
  const payloadHash = commandHash(command);
  const totalShares = command.paidShares + command.bonusShares;
  const tx = await sharesDb.begin();
  try {
    await tx.rawExec("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", `${command.source}:${command.sourceReference}`);
    const completed = await tx.rawQueryRow<{
      request_payload_sha256: string; purchase_id: string; certificate_id: string;
      completion_event_id: string; certificate_number: string; verification_id: string;
    }>(`SELECT operation.request_payload_sha256,operation.purchase_id,operation.certificate_id,
              operation.completion_event_id,certificate.certificate_number,certificate.verification_id
         FROM share_issuance_operations operation
         JOIN share_certificates certificate ON certificate.id=operation.certificate_id
        WHERE operation.operation_id=$1 OR (operation.source=$2 AND operation.source_reference=$3)
        LIMIT 1`, command.operationId, command.source, command.sourceReference);
    if (completed) {
      if (completed.request_payload_sha256 !== payloadHash) {
        throw APIError.alreadyExists("Share issuance idempotency key was reused with different terms");
      }
      await tx.commit();
      return {
        issued: false,
        purchaseId: completed.purchase_id,
        certificateId: completed.certificate_id,
        certificateNumber: completed.certificate_number,
        verificationId: completed.verification_id,
        completionEventId: completed.completion_event_id,
      };
    }

    const legacy = await tx.rawQueryRow<{
      purchase_id: string; certificate_id: string; certificate_number: string; verification_id: string;
    }>(`SELECT purchase.id AS purchase_id,certificate.id AS certificate_id,
              certificate.certificate_number,certificate.verification_id
         FROM share_purchases purchase
         JOIN share_certificates certificate ON certificate.id=purchase.certificate_id
        WHERE purchase.presale_order_reference=$1
        FOR UPDATE OF purchase,certificate`, command.sourceReference);

    let purchaseId: string;
    let certificateId: string;
    let certificateNumber: string;
    let verificationId: string;
    let issued = false;

    if (legacy) {
      if (!legacy.verification_id) {
        throw APIError.failedPrecondition(`Existing issuance ${command.sourceReference} has no sealed certificate`);
      }
      purchaseId = legacy.purchase_id;
      certificateId = legacy.certificate_id;
      certificateNumber = legacy.certificate_number;
      verificationId = legacy.verification_id;
    } else {
      const phase = await tx.rawQueryRow<{ id: string }>(`UPDATE share_phases
        SET quantity_available=quantity_available-$2,updated_at=now()
        WHERE phase_number=$1 AND status IN ('active','paused') AND quantity_available >= $2
        RETURNING id`, command.phaseNumber, totalShares);
      if (!phase) {
        throw APIError.failedPrecondition(`Share phase ${command.phaseNumber} cannot fulfil ${totalShares} shares`);
      }

      const lot = await tx.rawQueryRow<{ distinctive_from: number; distinctive_to: number }>(`UPDATE share_lot_sequence
        SET next_share_number=next_share_number+$1
        WHERE singleton=TRUE AND next_share_number+$1-1 <= 1200000
        RETURNING next_share_number-$1 AS distinctive_from,next_share_number-1 AS distinctive_to`, totalShares);
      if (!lot) throw APIError.failedPrecondition("The authorised Solidus share register is exhausted");

      const sequence = await tx.rawQueryRow<{ sequence: number }>(`INSERT INTO share_certificate_phase_sequences
        (phase_number,next_certificate_number) VALUES ($1,2)
        ON CONFLICT (phase_number) DO UPDATE
          SET next_certificate_number=share_certificate_phase_sequences.next_certificate_number+1
        RETURNING next_certificate_number-1 AS sequence`, command.phaseNumber);
      if (!sequence) throw new Error("share_certificate_sequence_not_created");

      purchaseId = crypto.randomUUID();
      certificateId = crypto.randomUUID();
      certificateNumber = solidusCertificateNumber(command.phaseNumber, sequence.sequence);
      verificationId = crypto.randomUUID();
      const issuedAt = new Date().toISOString();
      // Keep the commercial price as the exact decimal agreed by the presale
      // order. Recomputing it with JavaScript floating point can alter the
      // certificate snapshot and therefore its integrity seal.
      const issuePricePerShare = command.issuePricePerPaidShare;
      const seal = sealPresaleCertificate({
        verificationId,
        certificateNumber,
        holderName: command.holder.name,
        holderAddress: command.holder.address,
        profileNumber: command.holder.profileNumber,
        orderReference: command.sourceReference,
        totalShares,
        paidShares: command.paidShares,
        bonusShares: command.bonusShares,
        phaseNumber: command.phaseNumber,
        distinctiveFrom: lot.distinctive_from,
        distinctiveTo: lot.distinctive_to,
        issuePricePerShare,
        issuedAt,
      });

      await tx.rawExec(`INSERT INTO share_certificates
        (id,profile_id,certificate_number,total_shares,status,issued_at,presale_order_reference,source,
         phase_number,distinctive_from,distinctive_to,paid_shares,bonus_shares,verification_id,snapshot_version,
         holder_name_snapshot,holder_address_snapshot,profile_number_snapshot,issue_price_per_share_snapshot,
         issue_price_currency_snapshot,certificate_payload,certificate_payload_sha256)
        VALUES ($1,$2,$3,$4,'issued',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::numeric,$19,$20,$21)`,
      certificateId, command.profileId, certificateNumber, totalShares, issuedAt, command.sourceReference, command.source,
      command.phaseNumber, lot.distinctive_from, lot.distinctive_to, command.paidShares, command.bonusShares,
      verificationId, seal.data.version, command.holder.name.trim(), command.holder.address.trim(),
      command.holder.profileNumber.trim(), issuePricePerShare, command.currency, seal.payload, seal.sha256);
      await tx.rawExec(`INSERT INTO share_purchases
        (id,profile_id,phase_id,quantity,bonus_quantity,total_amount,status,certificate_id,presale_order_reference,source)
        VALUES ($1,$2,$3,$4,$5,$6::numeric,'paid',$7,$8,$9)`, purchaseId, command.profileId, phase.id,
      command.paidShares, command.bonusShares, command.acquisitionAmount, certificateId, command.sourceReference, command.source);
      issued = true;
    }

    const completionEventId = crypto.randomUUID();
    await tx.rawExec(`INSERT INTO shares_outbox
      (id,event_key,event_type,schema_version,correlation_id,aggregate_type,aggregate_id,payload)
      VALUES ($1,$2,'share_issuance_completed','share-issuance-completed.v1',$3,'share_purchase',$4,$5::jsonb)
      ON CONFLICT (event_key) DO NOTHING`, completionEventId, `${command.operationId}:completed`, command.operationId,
    purchaseId, JSON.stringify({ operationId: command.operationId, source: command.source, sourceReference: command.sourceReference,
      purchaseId, certificateId, certificateNumber, verificationId, totalShares }));
    const actualEvent = await tx.rawQueryRow<{ id: string }>("SELECT id FROM shares_outbox WHERE event_key=$1", `${command.operationId}:completed`);
    if (!actualEvent) throw new Error("share_issuance_completion_event_not_created");
    await tx.rawExec(`INSERT INTO share_issuance_operations
      (operation_id,source,source_reference,request_payload_sha256,purchase_id,certificate_id,completion_event_id,status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'completed')`, command.operationId, command.source, command.sourceReference,
    payloadHash, purchaseId, certificateId, actualEvent.id);
    await tx.commit();
    return { issued, purchaseId, certificateId, certificateNumber, verificationId, completionEventId: actualEvent.id };
  } catch (error) {
    try { await tx.rollback(); } catch { /* transaction may already be closed */ }
    throw error;
  }
}
