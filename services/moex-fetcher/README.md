### MOEX Stream Service

Сервис для получения сделок на бирже MOEX и записи их в ClickHouse.

#### Возможности
- Подключение к MOEX ISS API и потоковая выборка сделок.
- Автоматическое создание БД и/или таблицы в ClickHouse при старте.
- Гибкое расписание работы через календарь.
- Сдвиги рабочего окна: старт раньше и стоп позже базового расписания.

#### Требования
- Python 3.11+
- Доступный экземпляр ClickHouse

#### Предварительные шаги
1) Убедитесь, что `config/config.yml` заполнен (расписание торгов и т.п.) — креды ClickHouse/брокера в нём не хранятся, они берутся из корневого `.env`.
2) Убедитесь, что ClickHouse и Redpanda доступны из контейнера по адресам, указанным в `.env`.
3) Создайте внешнюю сеть Docker (если её ещё нет), которую использует compose-файл:
   ```bash
   docker network create dwh-net || true
   ```
   
> Примечания:
> - В `compose/docker-compose.yml` прописан `dns: 192.168.1.10`. При необходимости измените/удалите под вашу инфраструктуру.
   
#### Запуск через Docker Compose
1) Перейдите в директорию с compose-файлом:
   ```bash
   cd compose
   ```
2) Соберите и запустите сервис:
   ```bash
   docker compose up -d --build
   ```
3) Проверьте логи:
   ```bash
   docker compose logs -f
   ```
4) Остановка и удаление контейнера (без удаления образа):
   ```bash
   docker compose down
   ```

Что делает compose-файл:
- Собирает образ из корня проекта (`context: ..`, `dockerfile: compose/Dockerfile`).
- Монтирует локальный `../config/config.yml` внутрь контейнера в `/app/config/config.yml` (только чтение).
- Монтирует `../log` в `/app/log` для хранения логов на хосте.
- Запускает команду `python moex-fetcher.py`.
- Подключает контейнер к внешней сети `dwh-net`.

#### Альтернатива: чистый Docker (без compose)
Если хотите запустить напрямую через `docker`:
```bash
docker build -t moex-stream-service -f compose/Dockerfile .

# Важно: пути монтирования указаны относительно текущего каталога
# Убедитесь, что файл config/config.yml существует и корректен

docker run -d \
  --name moex-stream-service \
  --restart unless-stopped \
  --network dwh-net \
  -e PYTHONUNBUFFERED=1 \
  -v "$(pwd)/config/config.yml:/app/config/config.yml:ro" \
  -v "$(pwd)/log:/app/log" \
  moex-stream-service \
  python moex-fetcher.py
```