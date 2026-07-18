-- Author: Klaasvaakie ( |╲ )
INSERT INTO roles (name)
VALUES ('member'), ('admin')
ON CONFLICT (name) DO NOTHING;
