import { supabase, isSupabaseConfigured, supabaseAdmin } from "./supabase";

export interface MFAEnrollmentResult {
  id: string;
  type: "totp";
  secret: string;
  uri: string;
}

/**
 * Enrolls a new TOTP MFA factor in Supabase.
 */
export const enrollMFA = async (email: string) => {
  try {
    const { verifiedFactor, pendingFactor } = await getExistingMFAFactor();

    // Already enrolled
    if (verifiedFactor) {
      return {
        alreadyVerified: true,
        factorId: verifiedFactor.id,
      };
    }

    // Enrollment was started previously but not completed
    if (pendingFactor) {
      return {
        pendingEnrollment: true,
        factorId: pendingFactor.id,
      };
    }

    // No factor exists, create a new one
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Project P.A.T.R.O.L",
    });

    if (error) {
      throw error;
    }

    const secret = data.totp?.secret || data.totp?.qr_code || "";

    return {
      factorId: data.id,
      secret,
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
    // 1. Create Supabase Challenge
    const { data: challengeData, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) {
      throw challengeError;
    }

    // 2. Verify with Challenge ID
    const { data: verifyData, error: verifyError } =
      await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });

    if (verifyError) {
      console.warn(
        "Supabase MFA Verify challenge failed:",
        verifyError.message,
      );
      return false;
    }

    return true;
  } catch (err) {
    console.error("Real Supabase MFA verify failed:", err);
    throw err;
  }
};

/**
 * Checks if MFA is verified/enabled for the current user.
 */
export const checkMFAStatus = async (
  email: string,
): Promise<{
  isEnabled: boolean;
  factorId?: string;
  secret?: string;
  user_id?: string;
}> => {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  try {
    const { data, error } = await supabase.rpc("get_mfa_factors_by_email", {
      target_email: email.trim().toLowerCase(), // Normalize inputs safely
    });

    if (error) return { isEnabled: false };

    return {
      isEnabled: data[0].status === "verified",
      factorId: data[0].factor_id,
      secret: data[0].secret,
      user_id: data[0].user_id,
    };

    // const { data, error } = await supabase.auth.mfa.listFactors();
    // if (error) throw error;

    // if (!data || !data.all) {
    //   return { isEnabled: false };
    // }

    // // Find verified factor
    // const verifiedFactor = data.all.find(
    //   (factor) => factor.status === "verified",
    // );
    // if (verifiedFactor) {
    //   return { isEnabled: true, factorId: verifiedFactor.id };
    // }

    // return { isEnabled: false };
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
 * Generates the standard google authenticator otpauth scheme Uri
 * (allows users who want to print or construct their own uri QR generator)
 */
export function getOTPAuthUri(badge: string, secret: string): string {
  const label = encodeURIComponent(`Project P.A.T.R.O.L (${badge})`);
  const issuer = encodeURIComponent("INPPO");
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

export const getExistingMFAFactor = async () => {
  const { data, error } = await supabase.auth.mfa.listFactors();

  if (error) {
    throw error;
  }

  const verifiedFactor = data.all.find(
    (factor) => factor.status === "verified",
  );

  const pendingFactor = data.all.find((factor) => factor.status !== "verified");

  return {
    verifiedFactor,
    pendingFactor,
  };
};
