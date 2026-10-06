ALTER TABLE public.movimentacao
ADD COLUMN comprovante_url text NULL;

-- Configurar bucket comprovantes
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprovantes', 'comprovantes', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Leitura publica de comprovantes"
ON storage.objects FOR SELECT
USING (bucket_id = 'comprovantes');

CREATE POLICY "Upload de comprovantes"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'comprovantes' AND auth.uid() IS NOT NULL);

CREATE POLICY "Remocao de comprovantes"
ON storage.objects FOR DELETE
USING (bucket_id = 'comprovantes' AND auth.uid() IS NOT NULL);
