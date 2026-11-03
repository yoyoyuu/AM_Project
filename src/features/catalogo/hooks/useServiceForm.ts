import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import {
  serviceSchema,
  type ServiceFormValues,
} from '../schemas';

export function useServiceForm(
  defaultValues?: Partial<ServiceFormValues>,
) {
  return useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      title: defaultValues?.title ?? '',
      description: defaultValues?.description ?? null,
      price_mxn: defaultValues?.price_mxn ?? undefined,
      delivery_days: defaultValues?.delivery_days ?? undefined,
    },
    mode: 'onBlur',
  });
}
