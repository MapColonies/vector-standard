import type { Application } from 'express';
import type supertest from 'supertest';
import { agent } from 'supertest';
import type { Layer } from '@db';
import type { GetLayersResponse } from '@src/layer/types/layerTypes';

interface TypedResponse<T> extends Omit<supertest.Response, 'body'> {
  body: T;
}

export class LayerRequestSender {
  public constructor(private readonly app: Application) {}

  public async getLayers(): Promise<TypedResponse<GetLayersResponse>> {
    return agent(this.app).get('/layers');
  }

  public async getLayerByName(layerName: string): Promise<TypedResponse<Layer>> {
    return agent(this.app).get(`/layers/${layerName}`);
  }
}
