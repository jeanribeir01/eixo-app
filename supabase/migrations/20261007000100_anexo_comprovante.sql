-- EIX-34 (US03-b): comprovante em imagem anexado à movimentação.
--
-- A coluna guarda o caminho do arquivo dentro do bucket `comprovantes`, não uma URL: o bucket é
-- privado e o app abre a imagem com uma signed URL de curta duração (src/lib/storage.ts).
-- O bucket e as policies de storage.objects (só Admin e Financeiro) já vêm de
-- 20260924000600_storage_comprovantes.sql; esta migration não mexe neles.
alter table public.movimentacao add column caminho_comprovante text null;
