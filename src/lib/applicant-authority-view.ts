import { allowsApplicantAction, type ApplicantAuthority } from "./applicant-portal-contract";

export type ApplicantAuthorityView = {
  showReservation: boolean;
  canCreateReservation: boolean;
  transactionalActionsReady: boolean;
};

/** Reduces one server authority snapshot to browser presentation gates. */
export function applicantAuthorityView(authority: ApplicantAuthority | null): ApplicantAuthorityView {
  const available = Boolean(authority?.available);
  const showReservation = Boolean(available && authority?.reservation);
  return {
    showReservation,
    canCreateReservation: Boolean(!showReservation && allowsApplicantAction(authority, "create_reservation")),
    transactionalActionsReady: available,
  };
}
