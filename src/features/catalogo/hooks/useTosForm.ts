import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { tosSchema, type TosFormValues } from '../schemas';

export function useTosForm(defaultValues?: Partial<TosFormValues>) {
  return useForm<TosFormValues>({
    resolver: zodResolver(tosSchema),
    defaultValues: {
      content: defaultValues?.content ?? '',
    },
    mode: 'onChange',
  });
}
