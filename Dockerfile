# 정적 파일 서빙 전용 이미지 — vite 빌드는 호스트에서 하고 dist 만 복사한다.
#   npm run build && docker build -t doq-frontend .
# 경로 라우팅(/api → 백엔드)은 앞단 프록시가 담당한다. 여기서는 SPA 폴백만 처리한다.
FROM nginx:1.27-alpine

COPY dist /usr/share/nginx/html

# react-router 경로로 직접 진입해도 index.html 을 돌려준다
RUN printf 'server {\n\
  listen 80;\n\
  server_name _;\n\
  root /usr/share/nginx/html;\n\
  index index.html;\n\
  location /assets/ {\n\
    expires 1y;\n\
    add_header Cache-Control "public, immutable";\n\
  }\n\
  location / {\n\
    try_files $uri $uri/ /index.html;\n\
  }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80
