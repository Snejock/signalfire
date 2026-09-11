-- Именованная коллекция с кредами пользователя core — только уровень подключения
-- (host/port/user/password), без привязки к конкретной db/table. Переиспользуется
-- любыми будущими SOURCE(CLICKHOUSE(...)) (dictionary, table function и т.п.) —
-- каждый потребитель указывает свои db/table поверх неё, см. пример в
-- 017_create_dictionary_dds.r_securities_dict.sql.

CREATE NAMED COLLECTION IF NOT EXISTS default_collection ON CLUSTER replicated AS
    host = 'localhost',
    port = 9000,
    user = '<CLICKHOUSE_USERNAME>',
    password = '<CLICKHOUSE_PASSWORD>'
;