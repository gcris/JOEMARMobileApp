import { supabase, isSupabaseConfigured } from "./supabase";

export interface MFAEnrollmentResult {
  id: string;
  type: "totp";
  secret: string;
  uri: string;
}

/**
 * Enrolls a new TOTP MFA factor in Supabase.
 */
export const enrollMFA = async (
  email: string,
): Promise<MFAEnrollmentResult> => {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  try {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      issuer: "INPPO-Itrack",
      friendlyName: `INPPO-Geo Tracker`,
    });
    if (error) {
      throw error;
    }
    if (data && data.totp) {
      const localSecret = data.totp.secret;
      const customUri = `otpauth://totp/${email}?secret=${localSecret}&issuer=INPPO-Itrack&algorithm=SHA1&digits=6&period=30`;

      return {
        id: data.id,
        type: "totp",
        secret: localSecret,
        uri: customUri,
      };
    }

    throw new Error("Failed to enroll MFA factor");
  } catch (err) {
    console.error("Real Supabase MFA enrollment failed:", err);
    throw err;
  }
};

/**
 * Verifies a code against an enrolled MFA factor.
 * Challenges the factor first to follow true Supabase protocol semantics, then verifies.
 */
export const verifyMFAEnrollment = async (
  email: string,
  factorId: string,
  code: string,
  secretKey?: string,
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
): Promise<{ isEnabled: boolean; factorId?: string; secret?: string }> => {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  try {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw error;
    if (!data || !data.all) {
      return { isEnabled: false };
    }

    // Find verified factor
    const verifiedFactor = data.all.find((f) => f.status === "verified");
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
