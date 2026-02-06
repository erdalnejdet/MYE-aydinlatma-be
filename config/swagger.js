const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MYE Backend API',
      version: '1.0.0',
      description: 'MYE Admin Panel Backend API Documentation',
      contact: {
        name: 'API Support',
        email: 'support@mye.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      schemas: {
        Product: {
          type: 'object',
          required: ['name', 'sku', 'brand', 'originalPrice', 'currentPrice'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Product UUID',
            },
            name: {
              type: 'string',
              description: 'Product name',
              example: 'iC60H Miniature Circuit Breaker',
            },
            sku: {
              type: 'string',
              description: 'Stock Keeping Unit',
              example: 'SKU-001',
            },
            brand: {
              type: 'string',
              description: 'Product brand',
              example: 'SCHNEIDER ELECTRIC',
            },
            category: {
              type: 'string',
              description: 'Product category',
              example: 'Devre Kesiciler',
            },
            description: {
              type: 'string',
              description: 'Product description',
            },
            originalPrice: {
              type: 'number',
              format: 'decimal',
              description: 'Original price',
              example: 500.00,
            },
            currentPrice: {
              type: 'number',
              format: 'decimal',
              description: 'Current selling price',
              example: 450.00,
            },
            stockStatus: {
              type: 'string',
              enum: ['in_stock', 'low_stock', 'out_of_stock'],
              description: 'Stock status',
              example: 'in_stock',
            },
            stockQuantity: {
              type: 'integer',
              description: 'Stock quantity',
              example: 100,
            },
            images: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Array of image URLs',
              example: ['/uploads/image1.jpg'],
            },
            features: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Array of product features',
              example: ['2 Pole', '16A Rating'],
            },
            rating: {
              type: 'number',
              format: 'decimal',
              description: 'Product rating (0-5)',
              example: 4.8,
            },
            reviewCount: {
              type: 'integer',
              description: 'Number of reviews',
              example: 127,
            },
            technicalSpecs: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  label: {
                    type: 'string',
                    example: 'Kutup Sayısı',
                  },
                  value: {
                    type: 'string',
                    example: '3P',
                  },
                },
              },
              description: 'Array of technical specifications',
              example: [
                { label: 'Kutup Sayısı', value: '3P' },
                { label: 'Nominal Akım', value: '25A' },
              ],
            },
            reviews: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: {
                    type: 'integer',
                    example: 1,
                  },
                  author: {
                    type: 'string',
                    example: 'Ahmet Yılmaz',
                  },
                  role: {
                    type: 'string',
                    example: 'Elektrik Mühendisi',
                  },
                  rating: {
                    type: 'integer',
                    example: 5,
                  },
                  date: {
                    type: 'string',
                    example: '2 hafta önce',
                  },
                  comment: {
                    type: 'string',
                    example: 'Kaliteli ürün, hızlı teslimat.',
                  },
                  helpful: {
                    type: 'integer',
                    example: 24,
                  },
                },
              },
              description: 'Array of product reviews',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
            },
          },
        },
        ProductResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              $ref: '#/components/schemas/Product',
            },
          },
        },
        ProductListResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Product',
              },
            },
            pagination: {
              type: 'object',
              properties: {
                page: {
                  type: 'integer',
                  example: 1,
                },
                limit: {
                  type: 'integer',
                  example: 10,
                },
                total: {
                  type: 'integer',
                  example: 25,
                },
                totalPages: {
                  type: 'integer',
                  example: 3,
                },
                hasNextPage: {
                  type: 'boolean',
                  example: true,
                },
                hasPrevPage: {
                  type: 'boolean',
                  example: false,
                },
              },
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'string',
              example: 'Error message',
            },
          },
        },
        UploadResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  example: '/uploads/product-image-1234567890.jpg',
                },
                filename: {
                  type: 'string',
                  example: 'product-image-1234567890.jpg',
                },
                originalName: {
                  type: 'string',
                  example: 'product-image.jpg',
                },
                size: {
                  type: 'integer',
                  example: 245678,
                },
                mimetype: {
                  type: 'string',
                  example: 'image/jpeg',
                },
              },
            },
          },
        },
      },
    },
  },
  apis: ['./routes/*.js', './server.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
