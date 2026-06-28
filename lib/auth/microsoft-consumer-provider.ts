import type { OIDCConfig } from "@auth/core/providers";

// Personal-account (Consumer) Azure apps must use /consumers/ endpoints, not /common/.
// Discovery is served from consumers; id_token iss uses the consumer tenant GUID.
const CONSUMER_WELL_KNOWN =
  "https://login.microsoftonline.com/consumers/v2.0/.well-known/openid-configuration";
const CONSUMER_ISSUER =
  "https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0";

type MicrosoftProfile = {
  sub: string;
  name?: string;
  email?: string;
  preferred_username?: string;
};

export function MicrosoftConsumerProvider(options: {
  clientId: string;
  clientSecret: string;
}): OIDCConfig<MicrosoftProfile> {
  return {
    id: "microsoft-entra-id",
    name: "Microsoft",
    type: "oidc",
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    wellKnown: CONSUMER_WELL_KNOWN,
    issuer: CONSUMER_ISSUER,
    authorization: {
      params: {
        prompt: "select_account",
        scope: "openid profile email",
      },
    },
    profile(profile) {
      return {
        id: profile.sub,
        name: profile.name,
        email: profile.email ?? profile.preferred_username,
        image: null,
      };
    },
  };
}
