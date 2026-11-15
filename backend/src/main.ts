import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import type { AppConfig } from './config/app.config.js';

export function configureApp(app: NestExpressApplication): AppConfig {
  const configService = app.get(ConfigService);
  const appCfg = configService.get<AppConfig>('app');
  if (!appCfg) {
    throw new Error('Application configuration is not loaded');
  }

  if (appCfg.trustProxy) {
    app.set('trust proxy', 1);
  }

  if (appCfg.apiPrefix) {
    app.setGlobalPrefix(appCfg.apiPrefix);
  }

  // Handle root redirect so OAuth/magic-link landing on port 3000 redirects to frontend
  const expressApp = app.getHttpAdapter().getInstance();
  if (expressApp && typeof expressApp.get === 'function') {
    expressApp.get('/', (req: any, res: any) => {
      const isLocal = req.hostname === 'localhost' || req.hostname === '127.0.0.1';
      const targetOrigin = isLocal ? 'http://localhost:3001' : (appCfg.frontendUrl || 'https://hqms-chi.vercel.app');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>HQMS Redirecting...</title>
  <script>
    (function() {
      var isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      var target = isLocal ? ('http://' + window.location.hostname + ':3001') : ${JSON.stringify(appCfg.frontendUrl || 'https://hqms-chi.vercel.app')};
      var dest = target + '/' + window.location.search + window.location.hash;
      window.location.replace(dest);
    })();
  </script>
</head>
<body style="font-family:system-ui,sans-serif;text-align:center;padding:50px;color:#1e293b;background:#f8fafc;">
  <h2>Redirecting to HQMS Application...</h2>
  <p>If you are not redirected automatically, <a id="manual-link" href="${targetOrigin}">click here to open HQMS</a>.</p>
  <script>
    var l = document.getElementById('manual-link');
    if (l) {
      var isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      var target = isLocal ? ('http://' + window.location.hostname + ':3001') : ${JSON.stringify(appCfg.frontendUrl || 'https://hqms-chi.vercel.app')};
      l.href = target + '/' + window.location.search + window.location.hash;
    }
  </script>
</body>
</html>`);
    });
  }

  app.use(
    helmet({
      contentSecurityPolicy: appCfg.nodeEnv === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(cookieParser(appCfg.cookie.secret));

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (appCfg.allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed by CORS'), false);
    },
    credentials: true,
    exposedHeaders: ['Retry-After'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-CSRF-Token',
      'X-Organization-Id',
      'X-Client-Type',
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.enableShutdownHooks();

  return appCfg;
}

export function setupSwagger(app: NestExpressApplication, appCfg: AppConfig): void {
  const swaggerConfig = new DocumentBuilder()
    .setTitle(`${appCfg.appName} - Authentication & Authorization API`)
    .setDescription(
      'Reusable NestJS + PostgreSQL + Prisma authentication, dynamic RBAC, multi-tenant organization access control, session security, and audit platform.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addCookieAuth('access_token')
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'x-organization-id' },
      'x-organization-id',
    )
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'x-csrf-token' },
      'x-csrf-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  const docsPath = appCfg.apiPrefix ? `${appCfg.apiPrefix}/docs` : 'docs';
  SwaggerModule.setup(docsPath, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      withCredentials: true,
    },
  });
}

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const appCfg = configureApp(app);
  setupSwagger(app, appCfg);

  await app.listen(appCfg.port, '0.0.0.0');
  logger.log(
    `Server listening on port ${appCfg.port} (${appCfg.nodeEnv}) - Swagger at /${
      appCfg.apiPrefix ? `${appCfg.apiPrefix}/docs` : 'docs'
    }`,
  );
}

const isEntrypoint =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  (process.argv[1]?.endsWith('main.js') || process.argv[1]?.endsWith('main.ts'));

if (isEntrypoint) {
  await bootstrap();
}
