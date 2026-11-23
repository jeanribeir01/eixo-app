import type { Icon as PhosphorIcon } from 'phosphor-react-native';
// Um import por ícone, pelo caminho que o próprio Phosphor recomenda: importar do índice do pacote
// levaria os ~1.500 ícones para o bundle, porque o Metro não descarta código que não é usado.
import { ArrowsDownUpIcon } from 'phosphor-react-native/src/icons/ArrowsDownUp';
import { CalendarBlankIcon } from 'phosphor-react-native/src/icons/CalendarBlank';
import { CaretLeftIcon } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { ChartBarIcon } from 'phosphor-react-native/src/icons/ChartBar';
import { ChartLineUpIcon } from 'phosphor-react-native/src/icons/ChartLineUp';
import { CreditCardIcon } from 'phosphor-react-native/src/icons/CreditCard';
import { DotsThreeVerticalIcon } from 'phosphor-react-native/src/icons/DotsThreeVertical';
import { GearSixIcon } from 'phosphor-react-native/src/icons/GearSix';
import { HouseIcon } from 'phosphor-react-native/src/icons/House';
import { InfoIcon } from 'phosphor-react-native/src/icons/Info';
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
import { WrenchIcon } from 'phosphor-react-native/src/icons/Wrench';
import { XIcon } from 'phosphor-react-native/src/icons/X';

// Mapa único de ícones do app (DESIGN_CYAN §7). A tela pede pelo nome semântico ("financeiro") e nunca
// importa o ícone: trocar um ícone é mudar uma linha aqui. Phosphor (MIT) nas duas plataformas, para o
// app ter a mesma cara no Android e no iOS (ADR 0006).
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
  saldo: ChartLineUpIcon,
  dividas: ReceiptIcon,
  categorias: TagIcon,
  formasPagamento: CreditCardIcon,
  usuarios: UsersIcon,
  // Telas da Frota (Veículos usa o ícone da aba)
  rotas: MapTrifoldIcon,
  manutencoes: WrenchIcon,
  // Ações
  adicionar: PlusIcon,
  avancar: CaretRightIcon,
  voltarMes: CaretLeftIcon,
  avancarMes: CaretRightIcon,
  maisOpcoes: DotsThreeVerticalIcon,
  calendario: CalendarBlankIcon,
  limpar: XIcon,
  alerta: WarningIcon,
  sair: SignOutIcon,
  versao: InfoIcon,
} as const satisfies Record<string, PhosphorIcon>;

export type IconName = keyof typeof icons;
