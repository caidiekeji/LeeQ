#!/bin/sh
set -e

echo "等待数据库就绪..."
until pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER 2>/dev/null; do
  sleep 2
done

echo "初始化数据库表..."
node dist/config/initDb.js

echo "启动AI搜索引擎服务..."
exec node dist/index.js