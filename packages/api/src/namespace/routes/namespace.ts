import { Router } from 'express';
import type { FactoryFunction } from 'tsyringe';
import { NamespaceController } from '../controllers/namespaceController';

const namespaceRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(NamespaceController);

  router.get('/', controller.getNamespaces);

  return router;
};

export const NAMESPACE_ROUTER_SYMBOL = Symbol('namespaceRouterFactory');

export { namespaceRouterFactory };
