/**
 * One section of a type's auth form: the group's label from the
 * shared vocabulary, its (i) over the type's example card, and the
 * modified dot while the fold hides a set field — `AuthGroup` with the
 * info wired, so every editor (the per-type bodies, the OAuth 2.0
 * editor) sections the same way.
 */

import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { AUTH_GROUP_LABEL_KEY, type AuthGroupKey } from './auth-groups';
import { AuthGroup } from './auth-layout';
import { authGroupInfo, type CardAuthConfig } from './AuthRowInfo';

const AuthFormGroup: React.FC<{
  auth: CardAuthConfig;
  group: AuthGroupKey;
  modified: boolean;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}> = ({ auth, group, modified, defaultCollapsed, children }) => {
  const t = useT();
  return (
    <AuthGroup
      type={auth.type}
      group={group}
      label={t(AUTH_GROUP_LABEL_KEY[group])}
      info={authGroupInfo(t, auth, group)}
      modified={modified}
      defaultCollapsed={defaultCollapsed}
    >
      {children}
    </AuthGroup>
  );
};

export default AuthFormGroup;
