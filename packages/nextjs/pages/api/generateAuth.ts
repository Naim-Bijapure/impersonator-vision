import {
  GenerateAuthenticationOptionsOpts,
  GenerateRegistrationOptionsOpts,
  generateAuthenticationOptions,
  generateRegistrationOptions,
} from "@simplewebauthn/server";

const GENERATE_TYPES = {
  register: "register",
  auth: "auth",
};
export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ message: "Method not allowed" }); // 405 Method Not Allowed
    return;
  }

  const { type, rpID, userID, userName } = req.body;
  if (type === GENERATE_TYPES.register) {
    const opts: GenerateRegistrationOptionsOpts = {
      rpName: "SimpleWebAuthn Example",
      rpID,
      userID,
      userName,
      timeout: 60000,
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "required",
      },
      /**
       * Support the two most common algorithms: ES256, and RS256
       */
      supportedAlgorithmIDs: [-7, -257],
    };

    const options = await generateRegistrationOptions(opts);
    res.status(200).json({ type: "register", options });
  }

  if (type === GENERATE_TYPES.auth) {
    const opts: GenerateAuthenticationOptionsOpts = {
      timeout: 60000,
      userVerification: "required",
      rpID,
    };

    const options = await generateAuthenticationOptions(opts);

    res.status(200).json({ text: "auth", options });
  }
}
