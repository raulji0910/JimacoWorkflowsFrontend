FROM node:22-alpine AS build
WORKDIR /src

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Control de versiones (2026-11-23): la versión de package.json tiene que ser la misma de
# environment.production.ts (si no, la app creería siempre que hay una versión nueva) — se frena el build.
RUN node -e "const v=require('./package.json').version; const env=require('fs').readFileSync('src/environments/environment.production.ts','utf8'); if(!env.includes(\"'\"+v+\"'\")){console.error('La versión de package.json ('+v+') no coincide con environment.production.ts'); process.exit(1);}"
RUN npx ng build --configuration production
RUN node -e "require('fs').writeFileSync('dist/Jimaco.Aprobaciones.Web/browser/version.json', JSON.stringify({ version: require('./package.json').version }))"

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist/Jimaco.Aprobaciones.Web/browser /usr/share/nginx/html

EXPOSE 8080
