'use client';

import * as React from 'react';

export type AuthContextValue = {
  uid: string | null;
  gameCode: string | null;
};

export const AuthContext = React.createContext<AuthContextValue>({ uid: null, gameCode: null });
