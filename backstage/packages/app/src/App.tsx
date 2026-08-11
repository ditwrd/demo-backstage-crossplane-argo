import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import { crossplaneResourcesPlugin } from '@terasky/backstage-plugin-crossplane-resources-frontend/alpha';
import { navModule } from './modules/nav';

export default createApp({
  features: [catalogPlugin, navModule, crossplaneResourcesPlugin],
});
