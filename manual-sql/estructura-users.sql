select column_name, is_nullable, data_type
from information_schema.columns
where table_schema = 'auth' and table_name = 'users'
order by ordinal_position;