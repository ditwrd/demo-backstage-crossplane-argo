import {
  ApiBlueprint,
  createFrontendModule,
} from '@backstage/frontend-plugin-api';
import { githubAuthApiRef } from '@backstage/core-plugin-api';

// The gitops-manifest-updater form throws if githubAuthApi.getAccessToken()
// rejects, and guest-only auth has no GitHub OAuth session. It only uses the
// token to read the claim file from api.github.com, so an empty token (no
// Authorization header) is enough for public repos.
// PRs are still opened by the backend with integrations.github.token.
// ponytail: private repos need a real GitHub OAuth app + auth-backend github provider.
const anonymousGithubAuth = {
  getAccessToken: async () => '',
} as unknown as typeof githubAuthApiRef.T;

export const publicGithubModule = createFrontendModule({
  pluginId: 'app',
  extensions: [
    ApiBlueprint.make({
      name: 'github-auth',
      params: defineParams =>
        defineParams({
          api: githubAuthApiRef,
          deps: {},
          factory: () => anonymousGithubAuth,
        }),
    }),
  ],
});
