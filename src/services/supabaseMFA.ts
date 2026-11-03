import { supabase, isSupabaseConfigured } from "./supabase";

export interface MFAEnrollmentResult {
  id: string;
  type: "totp";
  secret: string;
  uri: string;
}

export interface MFAEnrollResult {
  factorId: string;
  alreadyVerified: boolean;
  pendingEnrollment: boolean; // kept so existing callers still compile; always false now
  secret?: string;
  uri?: string;
  qrCode?: string;
}

// Name shown in Google Authenticator
export const MFA_ISSUER = "INPPO Project Patrol";

/**
 * Looks at the factors that exist on the SERVER for the signed-in user.
 * (Never trust a factor id saved on the phone: an admin can remove factors
 * at any time.)
 */
export const getExistingMFAFactor = async () => {
  const { data, error } = await supabase.auth.mfa.listFactors();

  if (error) {
    throw error;
  }

  const all = (data?.all ?? []).filter((f) => f.factor_type === "totp");

  const verifiedFactor = all.find((f) => f.status === "verified");
  const pendingFactors = all.filter((f) => f.status !== "verified");

  return {
    verifiedFactor,
    pendingFactors,
  };
};

/**
 * Enrolls a new TOTP MFA factor in Supabase.
 *
 * - Already verified factor  -> returns it (login asks for the code)
 * - Abandoned (unverified) factors are deleted and a fresh one is created, so
 *   the officer always gets a new secret + QR code. Supabase only returns the
 *   secret ONCE, when the factor is created, so an old unverified factor can
 *   never be "resumed".
 */
export const enrollMFA = async (_email: string): Promise<MFAEnrollResult> => {
  try {
    const { verifiedFactor, pendingFactors } = await getExistingMFAFactor();

    // Already enrolled
    if (verifiedFactor) {
      return {
        alreadyVerified: true,
        pendingEnrollment: false,
        factorId: verifiedFactor.id,
      };
    }

    // Remove factors that were started but never verified
    for (const factor of pendingFactors) {
      const { error } = await supabase.auth.mfa.unenroll({
        factorId: factor.id,
      });
      if (error) {
        throw error;
      }
    }

    // Create a fresh factor
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: MFA_ISSUER,
    });

    if (error) {
      throw error;
    }

    return {
      factorId: data.id,
      secret: data.totp?.secret ?? "",
      uri: data.totp?.uri,
      qrCode: data.totp?.qr_code,
      pendingEnrollment: false,
      alreadyVerified: false,
    };
  } catch (error) {
    console.error("MFA enrollment failed:", error);
    throw error;
  }
};

/**
 * Verifies a code against an enrolled MFA factor.
 * Challenges the factor first to follow true Supabase protocol semantics, then verifies.
 */

export const verifyMFAChallenge = async (
  factorId: string,
  code: string,
): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  if (factorId.startsWith("sim_")) {
    throw new Error("Cannot verify simulated factor");
  }

  try {
    console.log("MFA VERIFY 1: Starting challenge");

    const { data: challengeData, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId });

    if (challengeError) {
      console.error("MFA VERIFY 1 FAILED:", challengeError);
      throw challengeError;
    }

    console.log("MFA VERIFY 2: Challenge created");

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code: code.trim(),
    });

    if (verifyError) {
      console.error("MFA VERIFY 2 FAILED:", verifyError);
      throw verifyError;
    }

    console.log("MFA VERIFY 3: Verification successful");
    return true;
  } catch (err) {
    console.error(
      "MFA CHALLENGE ERROR:",
      err instanceof Error ? err.message : String(err),
    );
    throw err;
  }
};

/**
 * Checks if MFA is verified/enabled for the CURRENT signed-in user, straight
 * from the server. If an admin removes the factors, this returns
 * isEnabled: false, and the login flow goes to the setup screen again.
 *
 * Call it AFTER signInWithPassword (it needs the session). On any error it
 * throws instead of returning "not enabled", so a network or server problem
 * can never skip the MFA check.
 */
export const checkMFAStatus = async (
  _email: string,
): Promise<{
  isEnabled: boolean;
  factorId?: string;
}> => {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  try {
    const { verifiedFactor } = await getExistingMFAFactor();

    if (verifiedFactor) {
      return { isEnabled: true, factorId: verifiedFactor.id };
    }

    return { isEnabled: false };
  } catch (err) {
    console.error("Error checking MFA status:", err);
    throw err;
  }
};

/**
 * Disables (unenrolls) the user's MFA.
 */
export const unenrollMFA = async (factorId: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  try {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      console.error("Supabase unenroll error:", error.message);
      throw error;
    }
    return true;
  } catch (err) {
    console.error("Unenrolling MFA via Supabase client failed:", err);
    throw err;
  }
};

/**
 * Standard Google Authenticator otpauth URI. The label is "issuer:account",
 * so the app shows "INPPO Project Patrol" with the badge number below it.
 * Use this to build the QR code and show the same name for manual entry.
 */
export function getOTPAuthUri(badge: string, secret: string): string {
  const issuer = encodeURIComponent(MFA_ISSUER);
  const account = encodeURIComponent(badge);
  return (
    `otpauth://totp/${issuer}:${account}` +
    `?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`
  );
}
