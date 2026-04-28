# KCC Luiz

Sistema web full stack com React, FastAPI, PostgreSQL, Docker Compose e Nginx, pronto para desenvolvimento local e deploy em VPS.

## 1. Visão Geral da Solução

A aplicação é dividida em frontend, backend, infraestrutura e documentação. O frontend React consome a API pelo caminho relativo `/api/v1`, e o Nginx interno do stack encaminha `/api/` para o backend e `/` para o frontend.

A estratégia de produção escolhida é subdomínio dedicado, por exemplo `novoapp.seudominio.com`. Como já existe outro sistema usando 80/443 na VPS, este stack não tenta assumir essas portas. Em produção, ele publica apenas `127.0.0.1:18080`, e o Nginx principal da VPS encaminha o tráfego HTTPS para essa porta local.

## 2. Estrutura de Pastas

```text
.
├── backend
│   ├── alembic
│   ├── app
│   │   ├── api
│   │   ├── core
│   │   ├── db
│   │   ├── models
│   │   ├── repositories
│   │   ├── schemas
│   │   ├── scripts
│   │   └── services
│   └── tests
├── frontend
│   └── src
│       ├── components
│       ├── context
│       ├── hooks
│       ├── pages
│       ├── routes
│       ├── services
│       └── styles
├── infra
│   ├── nginx
│   └── scripts
└── docs
```

## 3. Arquivos Backend

Principais arquivos:

- `backend/app/main.py`: cria a aplicação FastAPI, CORS, healthcheck, handlers e rotas versionadas.
- `backend/app/api/v1/routers/auth.py`: cadastro, login, refresh, logout e `/me`.
- `backend/app/api/deps.py`: dependency de autenticação e base para autorização por papéis.
- `backend/app/core/security.py`: hash Argon2 e criação/validação de JWT.
- `backend/app/services/auth_service.py`: regra de autenticação e emissão de tokens.
- `backend/app/repositories/user_repository.py`: acesso ao modelo de usuário.
- `backend/app/models/user.py`: tabela `users`.
- `backend/alembic/versions/0001_initial_users.py`: migration inicial.
- `backend/tests/test_auth.py`: teste básico do fluxo de autenticação.

Rotas:

- `GET /health`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `GET /api/v1/users/me`
- Swagger em `/docs`

## 4. Arquivos Frontend

Principais arquivos:

- `frontend/src/services/api.ts`: cliente Axios com `withCredentials`, bearer token e refresh automático.
- `frontend/src/context/AuthContext.tsx`: estado global de autenticação.
- `frontend/src/components/PrivateRoute.tsx`: proteção de rotas privadas.
- `frontend/src/pages/LoginPage.tsx`: login com validação e estados de erro.
- `frontend/src/pages/RegisterPage.tsx`: cadastro com validação.
- `frontend/src/pages/DashboardPage.tsx`: tela inicial autenticada.
- `frontend/src/styles/index.css`: layout responsivo e profissional.
- `frontend/vite.config.ts`: proxy local de `/api` para o backend.

O access token fica em memória. O refresh token fica em cookie httpOnly, reduzindo exposição a JavaScript. Ao recarregar a página, o app chama `/auth/refresh` para recuperar uma sessão ativa.

## 5. Arquivos Docker

- `backend/Dockerfile`: targets `development` e `production`.
- `frontend/Dockerfile`: target de desenvolvimento com Vite e produção com Nginx estático.
- `docker-compose.yml`: ambiente local com portas `5432`, `8000`, `5173` e proxy em `8080`.
- `docker-compose.prod.yml`: produção com banco e serviços internos; publica apenas o proxy em `127.0.0.1:18080`.

## 6. Arquivos Nginx

- `infra/nginx/app.conf`: Nginx interno do stack. Encaminha `/api/` para `backend:8000` e `/` para `frontend:80`.
- `frontend/nginx.conf`: serve os arquivos do React com fallback para `index.html`.
- `infra/nginx/main-vps-server-block.conf`: exemplo de server block para o Nginx principal da VPS.

O fallback de SPA acontece no Nginx do frontend, então rotas como `/dashboard` podem ser servidas pelo React Router.

## 7. `.env.example`

Copie o arquivo:

```bash
cp .env.example .env
```

Variáveis mais importantes:

- `SECRET_KEY`: segredo longo para JWT.
- `DATABASE_URL`: URL SQLAlchemy do PostgreSQL.
- `CORS_ORIGINS`: origens permitidas.
- `COOKIE_SECURE`: `true` em produção com HTTPS.
- `APP_DOMAIN`: subdomínio final em produção.
- `PUBLIC_HTTP_PORT`: porta local exposta pelo stack de produção, por padrão `127.0.0.1:18080`.

## 8. README de Execução

Desenvolvimento local:

```bash
cp .env.example .env
docker compose up --build
```

Desenvolvimento com Docker Compose Watch:

```bash
cp .env.example .env
docker compose watch
```

O modo watch sincroniza mudanças em `backend/app`, `backend/tests` e `frontend/src`. Alterações em `package.json`, `package-lock.json`, `pyproject.toml` ou Dockerfiles disparam rebuild automático. O backend usa `uvicorn --reload` e o frontend usa o watch do Vite com polling habilitado para funcionar melhor em Docker no Windows.

Acesse:

- App via proxy: `http://localhost:18081`
- Frontend Vite direto: `http://localhost:15173`
- Backend direto: `http://localhost:18000`
- Swagger via proxy: `http://localhost:18081/docs`
- Swagger direto no backend: `http://localhost:18000/docs`

Rodar migrations manualmente:

```bash
docker compose exec backend alembic upgrade head
```

Criar admin opcional:

```bash
docker compose exec backend python -m app.scripts.seed_admin
```

Testes:

```bash
docker compose exec backend pytest -q
docker compose exec frontend npm run build
```

## 9. Instruções de Deploy na VPS

1. Instale Docker e Docker Compose Plugin conforme `docs/deploy-vps.md`.
2. Clone o projeto na VPS.
3. Configure `.env` com valores reais.
4. Garanta:

```env
APP_ENV=production
APP_DOMAIN=novoapp.seudominio.com
COOKIE_SECURE=true
CORS_ORIGINS=https://novoapp.seudominio.com
PUBLIC_HTTP_PORT=127.0.0.1:18080
```

5. Suba o stack:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

6. Configure o Nginx principal usando `infra/nginx/main-vps-server-block.conf`.
7. Emita ou renove o certificado:

```bash
sudo certbot --nginx -d novoapp.seudominio.com
sudo systemctl reload nginx
```

Atualização:

```bash
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d --remove-orphans
```

## 10. Como Coexistir com Outro Sistema na Mesma VPS

O outro sistema continua dono das portas públicas 80 e 443 por meio do Nginx principal. Este novo stack roda isolado em Docker e expõe apenas uma porta local:

```text
Internet -> Nginx principal :443 -> http://127.0.0.1:18080 -> Nginx interno do stack -> frontend/backend
```

Isso evita conflito de portas e mantém a separação operacional. O Nginx principal decide pelo `server_name` qual sistema recebe o tráfego. Para o novo sistema, use `novoapp.seudominio.com`; para o sistema existente, preserve o server block atual.

## Decisões Arquiteturais

- Subdomínio em vez de subpath: menos frágil para React Router, cookies e API.
- Refresh token httpOnly: reduz o impacto de XSS sobre tokens longos.
- Access token em memória: evita persistência em `localStorage`.
- API versionada: permite evolução futura sem quebrar clientes.
- Camadas no backend: melhora testabilidade e manutenção.
- Compose separado para dev/prod: permite hot reload local e imagem otimizada em produção.

## Checklist Manual

- [ ] `docker compose up --build` inicia todos os serviços.
- [ ] `GET /health` retorna `ok`.
- [ ] Cadastro cria usuário.
- [ ] Login retorna access token.
- [ ] Reload do navegador mantém sessão via refresh cookie.
- [ ] Logout limpa a sessão.
- [ ] Swagger abre em `/docs`.
- [ ] Produção não expõe PostgreSQL publicamente.
- [ ] Nginx principal encaminha apenas o subdomínio novo para `127.0.0.1:18080`.

## Próximos Passos

- Persistir refresh tokens com hash, `jti`, expiração e revogação.
- Adicionar RBAC por rota e tela.
- Criar pipeline CI com testes e build.
- Adicionar backup automático do PostgreSQL.
- Instrumentar métricas e tracing.
- Adicionar rate limit no Nginx ou backend.
