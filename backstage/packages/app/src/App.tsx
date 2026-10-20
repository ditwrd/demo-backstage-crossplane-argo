import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import { crossplaneResourcesPlugin } from '@terasky/backstage-plugin-crossplane-resources-frontend/alpha';
import { gitopsManifestUpdaterPlugin } from '@terasky/backstage-plugin-gitops-manifest-updater/alpha';
import { navModule } from './modules/nav';
import { publicGithubModule } from './modules/public-github';

export default createApp({
  features: [
    catalogPlugin,
    navModule,
    crossplaneResourcesPlugin,
    gitopsManifestUpdaterPlugin,
    publicGithubModule,
  ],
});
