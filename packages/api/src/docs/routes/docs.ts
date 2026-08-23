import { Router } from 'express';
import type { Request, RequestHandler } from 'express';
import type { FactoryFunction } from 'tsyringe';
import { OpenapiViewerRouter } from '@map-colonies/openapi-express-viewer';
import { PREFIX_HEADER, ROOT_HEADER, SERVICES } from '@common/constants';
import { loadSpec, toPublicSpec } from '@common/openapi';
import type { OpenapiSpec } from '@common/interfaces';
import type { ConfigType } from '@common/config';

const docsRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const config = dependencyContainer.resolve<ConfigType>(SERVICES.CONFIG);
  const openapiConfig = config.get('openapiConfig');
  const spec = loadSpec(openapiConfig.filePath);

  const viewerRouter = new OpenapiViewerRouter({ ...openapiConfig, filePathOrSpec: spec });
  viewerRouter.setup();

  const usePublicSpec: RequestHandler = (req, res, next) => {
    const namespaced = req.get(PREFIX_HEADER);
    const root = req.get(ROOT_HEADER);
    const behindGateway = namespaced !== undefined && root !== undefined;

    (req as Request & { swaggerDoc?: OpenapiSpec }).swaggerDoc = behindGateway ? toPublicSpec(spec, { namespaced, root }) : spec;

    next();
  };

  const router = Router();
  router.use(usePublicSpec, viewerRouter.getRouter());

  return router;
};

const DOCS_ROUTER_SYMBOL = Symbol('docsRouterFactory');

export { docsRouterFactory, DOCS_ROUTER_SYMBOL };
