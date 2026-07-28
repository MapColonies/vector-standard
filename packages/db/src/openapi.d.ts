/* eslint-disable */
// This file was auto-generated. Do not edit manually.
// To update, run the error generation script again.

import type { TypedRequestHandlers as ImportedTypedRequestHandlers } from '@map-colonies/openapi-helpers/typedRequestHandler';
export type paths = {
  '/layers': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Get all layer names */
    get: operations['getLayers'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/layers/{layerName}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Get layer spec by name */
    get: operations['getLayerByName'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
};
export type webhooks = Record<string, never>;
export type components = {
  schemas: {
    /** @description Basic layer info returned in the list endpoint. */
    LayerSummary: {
      /**
       * @description Name of the layer
       * @example buildings_polygon
       */
      layerName: string;
      /**
       * @description Display alias for the layer
       * @example Buildings
       */
      alias: string;
    };
    /** @description Response wrapper for the list of layers. */
    LayerList: {
      layers: components['schemas']['LayerSummary'][];
    };
    /** @description A layer and all of its properties. Groups rows from the `Property` entity by `layerName`. */
    LayerSpec: {
      /**
       * @description Name of the layer
       * @example buildings_polygon
       */
      layerName: string;
      /**
       * @description Display alias for the layer
       * @example Buildings
       */
      alias: string;
      properties: components['schemas']['Property'][];
    };
    /** @description A single property definition for a layer. Mirrors the `Property` entity, minus `id` and `layerName` (which are implicit on the parent `LayerSpec`). When the property has coded/enumerated values, `possibleValues` is populated. */
    Property: {
      /**
       * @description Property name
       * @example code
       */
      property: string;
      type: components['schemas']['Type'];
      /**
       * @description Display alias for the property
       * @example Number of Floors
       */
      alias?: string;
      /** @description Allowed values for properties that have a fixed set of coded values. Omitted when the property accepts arbitrary values. */
      possibleValues?: string[];
    };
    /**
     * @description GeoServer-compatible WFS type (XSD scalar or GML geometry)
     * @example xsd:string
     */
    Type: string;
    /** @description Standard error response */
    Error: {
      /** @example 404 */
      code: number;
      /** @example Layer not found */
      message: string;
    };
  };
  responses: {
    /** @description A list of layers with their display aliases */
    LayerListResponse: {
      headers: {
        [name: string]: unknown;
      };
      content: {
        /**
         * @example {
         *       "layers": [
         *         {
         *           "layerName": "buildings_polygon",
         *           "alias": "Buildings"
         *         },
         *         {
         *           "layerName": "fences_line",
         *           "alias": "Fences"
         *         }
         *       ]
         *     }
         */
        'application/json': components['schemas']['LayerList'];
      };
    };
    /** @description Full layer specification including its properties */
    LayerSpecResponse: {
      headers: {
        [name: string]: unknown;
      };
      content: {
        /**
         * @example {
         *       "layerName": "buildings_polygon",
         *       "alias": "Buildings Polygon",
         *       "properties": [
         *         {
         *           "property": "code",
         *           "type": "xsd:long",
         *           "possibleValues": [
         *             "1001",
         *             "1002"
         *           ]
         *         },
         *         {
         *           "property": "name",
         *           "type": "xsd:string"
         *         },
         *         {
         *           "property": "number_of_floors",
         *           "type": "xsd:long",
         *           "alias": "Number of Floors"
         *         },
         *         {
         *           "property": "geom",
         *           "type": "gml:PolygonPropertyType"
         *         }
         *       ]
         *     }
         */
        'application/json': components['schemas']['LayerSpec'];
      };
    };
    /** @description The requested resource was not found */
    NotFound: {
      headers: {
        [name: string]: unknown;
      };
      content: {
        'application/json': components['schemas']['Error'];
      };
    };
  };
  parameters: {
    /** @description The name of the layer (matches `Property.layerName`) */
    LayerNameParam: string;
  };
  requestBodies: never;
  headers: never;
  pathItems: never;
};
export type $defs = Record<string, never>;
export interface operations {
  getLayers: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: components['responses']['LayerListResponse'];
      404: components['responses']['NotFound'];
    };
  };
  getLayerByName: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @description The name of the layer (matches `Property.layerName`) */
        layerName: components['parameters']['LayerNameParam'];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: components['responses']['LayerSpecResponse'];
      404: components['responses']['NotFound'];
    };
  };
}
export type TypedRequestHandlers = ImportedTypedRequestHandlers<paths, operations>;
