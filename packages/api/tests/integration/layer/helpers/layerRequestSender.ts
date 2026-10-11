import type { Application } from 'express';
import type supertest from 'supertest';
import { agent } from 'supertest';
import type { Layer } from '@db';
import type { GetLayersResponse } from '@src/layer/types/layerTypes';
import type { GetNamespacesResponse } from '@src/namespace/types/namespaceTypes';

interface TypedResponse<T> extends Omit<supertest.Response, 'body'> {
  body: T;
}

export class LayerRequestSender {
  public constructor(private readonly app: Application) {}

  public async getNamespaces(): Promise<TypedResponse<GetNamespacesResponse>> {
    return agent(this.app).get('/namespaces');
  }

  public async getLayers(namespace: string): Promise<TypedResponse<GetLayersResponse>> {
    return agent(this.app).get(`/namespaces/${namespace}/layers`);
  }

  public async getLayerByName(namespace: string, layerName: string): Promise<TypedResponse<Layer>> {
    return agent(this.app).get(`/namespaces/${namespace}/layers/${layerName}`);
  }
}
