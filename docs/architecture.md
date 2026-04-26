# Arquitetura

## Visão Geral

O projeto usa React com Vite no frontend, FastAPI no backend, PostgreSQL como banco e Nginx como proxy interno do stack. A aplicação expõe a API em `/api/v1` e o frontend consome sempre `/api/v1`, sem domínio hardcoded.

## Decisão de Proxy

A estratégia escolhida é subdomínio dedicado, por exemplo `novoapp.seudominio.com`.

Essa abordagem é mais robusta para SPA com React Router, cookies httpOnly e API versionada. Subpath, como `/novoapp`, também funciona, mas exige ajustar `base` no Vite, caminhos de cookies, redirects e regras Nginx para remover ou preservar prefixos. Em produção, subdomínio reduz acoplamento com o sistema já existente.

## Camadas do Backend

- `routers`: entrada HTTP e contratos de rotas.
- `schemas`: validação e serialização com Pydantic.
- `models`: entidades SQLAlchemy.
- `repositories`: acesso ao banco.
- `services`: regras de negócio.
- `core`: configuração, segurança, logging e tratamento de erros.

## Autenticação

O access token JWT fica apenas em memória no frontend. O refresh token é enviado em cookie `httpOnly`, com `SameSite=Lax` e `Secure=true` em produção.

Essa escolha reduz exposição do refresh token a JavaScript em caso de XSS. O custo é que, ao recarregar a página, o frontend precisa chamar `/auth/refresh` para obter novo access token. O backend já emite novo refresh token em cada refresh, deixando a base preparada para rotação completa com lista de tokens revogados no banco ou Redis.
