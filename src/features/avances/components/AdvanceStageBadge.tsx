import { Badge } from '../../../components/ui';
import { getStageName } from '../../gestion/stateMachine';
import type { CreativeStage } from '../../gestion/types';

interface Props {
  stage: CreativeStage;
}

export function AdvanceStageBadge({ stage }: Props) {
  return <Badge tone="primary" label={getStageName(stage)} icon="•" />;
}
