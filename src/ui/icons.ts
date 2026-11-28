import type { Icon as PhosphorIcon } from 'phosphor-react-native';
// Um import por ícone, pelo caminho que o próprio Phosphor recomenda: importar do índice do pacote
// levaria os ~1.500 ícones para o bundle, porque o Metro não descarta código que não é usado.
import { ArrowDownLeftIcon } from 'phosphor-react-native/src/icons/ArrowDownLeft';
import { ArrowsDownUpIcon } from 'phosphor-react-native/src/icons/ArrowsDownUp';
import { ArrowUpRightIcon } from 'phosphor-react-native/src/icons/ArrowUpRight';
import { CalendarBlankIcon } from 'phosphor-react-native/src/icons/CalendarBlank';
import { CameraIcon } from 'phosphor-react-native/src/icons/Camera';
import { CaretDownIcon } from 'phosphor-react-native/src/icons/CaretDown';
import { CaretLeftIcon } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { ChartBarIcon } from 'phosphor-react-native/src/icons/ChartBar';
import { ChartLineUpIcon } from 'phosphor-react-native/src/icons/ChartLineUp';
import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle';
import { ClockIcon } from 'phosphor-react-native/src/icons/Clock';
import { CloudArrowUpIcon } from 'phosphor-react-native/src/icons/CloudArrowUp';
import { CloudCheckIcon } from 'phosphor-react-native/src/icons/CloudCheck';
import { CreditCardIcon } from 'phosphor-react-native/src/icons/CreditCard';
import { DotsThreeVerticalIcon } from 'phosphor-react-native/src/icons/DotsThreeVertical';
import { EnvelopeSimpleIcon } from 'phosphor-react-native/src/icons/EnvelopeSimple';
import { FileCsvIcon } from 'phosphor-react-native/src/icons/FileCsv';
import { FilePdfIcon } from 'phosphor-react-native/src/icons/FilePdf';
import { GaugeIcon } from 'phosphor-react-native/src/icons/Gauge';
import { GearSixIcon } from 'phosphor-react-native/src/icons/GearSix';
import { HouseIcon } from 'phosphor-react-native/src/icons/House';
import { ImageIcon } from 'phosphor-react-native/src/icons/Image';
import { InfoIcon } from 'phosphor-react-native/src/icons/Info';
import { LockSimpleIcon } from 'phosphor-react-native/src/icons/LockSimple';
import { MagnifyingGlassIcon } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import { MapTrifoldIcon } from 'phosphor-react-native/src/icons/MapTrifold';
import { PathIcon } from 'phosphor-react-native/src/icons/Path';
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { ReceiptIcon } from 'phosphor-react-native/src/icons/Receipt';
import { SignOutIcon } from 'phosphor-react-native/src/icons/SignOut';
import { TagIcon } from 'phosphor-react-native/src/icons/Tag';
import { TruckIcon } from 'phosphor-react-native/src/icons/Truck';
import { UserCircleIcon } from 'phosphor-react-native/src/icons/UserCircle';
import { UsersIcon } from 'phosphor-react-native/src/icons/Users';
import { WalletIcon } from 'phosphor-react-native/src/icons/Wallet';
import { WarningIcon } from 'phosphor-react-native/src/icons/Warning';
import { WifiSlashIcon } from 'phosphor-react-native/src/icons/WifiSlash';
import { WrenchIcon } from 'phosphor-react-native/src/icons/Wrench';
import { XIcon } from 'phosphor-react-native/src/icons/X';

// Mapa único de ícones do app (DESIGN_CYAN §7). A tela pede pelo nome semântico ("financeiro") e nunca
// importa o ícone: trocar um ícone é mudar uma linha aqui. Phosphor (MIT) nas duas plataformas, para o
// app ter a mesma cara no Android e no iOS (ADR 0007).
export const icons = {
  // Abas do menu (US17)
  inicio: HouseIcon,
  dashboards: ChartBarIcon,
  financeiro: WalletIcon,
  frota: TruckIcon,
  viagens: PathIcon,
  configuracoes: GearSixIcon,
  conta: UserCircleIcon,
  // Telas do Financeiro
  movimentacoes: ArrowsDownUpIcon,
  // Direção do dinheiro: entra no caixa (seta para dentro) ou sai (seta para fora).
  entrada: ArrowDownLeftIcon,
  saida: ArrowUpRightIcon,
  saldo: ChartLineUpIcon,
  dividas: ReceiptIcon,
  categorias: TagIcon,
  formasPagamento: CreditCardIcon,
  usuarios: UsersIcon,
  // Telas da Frota (Veículos usa o ícone da aba)
  rotas: MapTrifoldIcon,
  manutencoes: WrenchIcon,
  hodometro: GaugeIcon,
  // Ações
  adicionar: PlusIcon,
  avancar: CaretRightIcon,
  // Seção aberta (ex.: "Desativadas" em Categorias); fechada, a seção usa `avancar`.
  recolher: CaretDownIcon,
  voltarMes: CaretLeftIcon,
  avancarMes: CaretRightIcon,
  maisOpcoes: DotsThreeVerticalIcon,
  calendario: CalendarBlankIcon,
  limpar: XIcon,
  buscar: MagnifyingGlassIcon,
  alerta: WarningIcon,
  // Estado "tudo em dia" (Início sem nada pedindo atenção).
  sucesso: CheckCircleIcon,
  sair: SignOutIcon,
  // Campos do login de teste: o ícone diz o que vai no campo antes de a pessoa ler o rótulo.
  email: EnvelopeSimpleIcon,
  senha: LockSimpleIcon,
  // Estados da conta e do envio (Aguardando aprovação, Sincronização).
  aguardando: ClockIcon,
  bloqueado: LockSimpleIcon,
  semInternet: WifiSlashIcon,
  enviando: CloudArrowUpIcon,
  enviado: CloudCheckIcon,
  versao: InfoIcon,
  // Opções das folhas de escolha: de onde vem o comprovante e em que formato sai o relatório.
  camera: CameraIcon,
  galeria: ImageIcon,
  planilha: FileCsvIcon,
  pdf: FilePdfIcon,
} as const satisfies Record<string, PhosphorIcon>;

export type IconName = keyof typeof icons;
