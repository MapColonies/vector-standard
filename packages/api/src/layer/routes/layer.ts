import { Router } from 'express';
import type { FactoryFunction } from 'tsyringe';
import { LayerController } from '../controllers/layerController';

const layerRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(LayerController);

  router.get('/', controller.getLayers);
  router.get('/:layerName', controller.getLayerByName);

  return router;
};

export const LAYER_ROUTER_SYMBOL = Symbol('layerRouterFactory');

export { layerRouterFactory };
