import { useState } from 'react';
import { Alert } from 'react-native';

import { rotuloDoPeriodo, type Periodo } from '@/features/dashboard/periodo';
import { hojeISO } from '@/lib/datas';
import { Button, Column, Text, type SnackbarTone } from '@/ui';

import { nomeDoArquivo } from './arquivo';
import { compartilharArquivo, gerarArquivoCsv, gerarArquivoPdf } from './compartilhar';
import { gerarCsv } from './csv';
import { nomeDaEmpresa } from './empresa';
import type { FormatoRelatorio, TransacaoRelatorio } from './linhas';
import { gerarHtmlPdf } from './pdf';
import { buscarTransacoesDoPeriodo, MENSAGEM_ERRO_RELATORIO } from './queries';

type ExportarRelatorioProps = {
  // O período em uso no FiltroPeriodo da aba Dashboards.
  periodo: Periodo;
  // O Snackbar mora no overlay da tela (este componente não tem Screen própria).
  onFeedback: (mensagem: string, tom: SnackbarTone) => void;
};

// Período sem transação: avisa antes de gerar um arquivo vazio (AC da US14). Avisar, não proibir: o
// contador pode querer o arquivo vazio como comprovante de que o mês não teve movimento.
function confirmarPeriodoVazio(rotulo: string): Promise<boolean> {
  return new Promise((resolver) => {
    Alert.alert(
      'Nenhuma transação no período',
      `${rotulo} não tem transações. O arquivo sairá só com o cabeçalho.`,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolver(false) },
        { text: 'Gerar mesmo assim', onPress: () => resolver(true) },
      ],
      // No Android o alerta também fecha pelo botão voltar ou tocando fora: conta como cancelar.
      { cancelable: true, onDismiss: () => resolver(false) },
    );
  });
}

async function gerarArquivo(formato: FormatoRelatorio, periodo: Periodo, transacoes: TransacaoRelatorio[]) {
  const nome = nomeDoArquivo(periodo, formato);
  if (formato === 'csv') return gerarArquivoCsv(nome, gerarCsv(transacoes));

  const html = gerarHtmlPdf({
    empresa: nomeDaEmpresa(),
    periodo: rotuloDoPeriodo(periodo),
    geradoEm: hojeISO(),
    transacoes,
  });
  return gerarArquivoPdf(nome, html);
}

// Exportação do relatório financeiro (US14, EIX-47): as transações do período em CSV ou PDF, entregues
// pelo Share Sheet do sistema. Só Admin e Financeiro veem este componente (a tela decide); o RLS de
// `movimentacao` decide no banco.
export function ExportarRelatorio({ periodo, onFeedback }: ExportarRelatorioProps) {
  const [exportando, setExportando] = useState(false);
  const rotulo = rotuloDoPeriodo(periodo);

  async function exportar(formato: FormatoRelatorio) {
    setExportando(true);
    try {
      const busca = await buscarTransacoesDoPeriodo(periodo);
      if (!busca.ok) {
        onFeedback(busca.mensagem, 'error');
        return;
      }

      if (busca.data.length === 0 && !(await confirmarPeriodoVazio(rotulo))) return;

      const arquivo = await gerarArquivo(formato, periodo, busca.data);
      if (!arquivo.ok) {
        onFeedback(arquivo.mensagem, 'error');
        return;
      }

      const envio = await compartilharArquivo(arquivo.data);
      if (!envio.ok) {
        onFeedback(envio.mensagem, 'error');
        return;
      }

      // O Share Sheet não diz se a pessoa enviou ou cancelou: a mensagem fala da geração.
      onFeedback('Relatório gerado.', 'success');
    } catch {
      // Rede de segurança: qualquer exceção inesperada no meio do caminho ainda vira mensagem na tela.
      onFeedback(MENSAGEM_ERRO_RELATORIO, 'error');
    } finally {
      // Todo caminho, inclusive o de erro, devolve o botão: ele nunca fica preso em loading.
      setExportando(false);
    }
  }

  // Nada é consultado antes da escolha do formato: cancelar aqui não custa uma ida ao banco.
  function escolherFormato() {
    Alert.alert('Exportar relatório', `Transações de ${rotulo}. Em qual formato?`, [
      { text: 'Planilha (CSV)', onPress: () => void exportar('csv') },
      { text: 'PDF', onPress: () => void exportar('pdf') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  return (
    <Column gap="sm" align="start">
      <Text variant="bodySm" tone="body">
        Envie as transações do período para a contabilidade, em planilha (CSV) ou PDF.
      </Text>
      {/* O único cyan preenchido da aba: ela não tem outra ação primária (DESIGN_CYAN §1). */}
      <Button
        label="Exportar"
        onPress={escolherFormato}
        loading={exportando}
        accessibilityLabel={`Exportar relatório de ${rotulo}`}
      />
    </Column>
  );
}
