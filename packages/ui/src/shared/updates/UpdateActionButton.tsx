/**
 * The button that starts or finishes an app update — Update & Restart,
 * Restart to install.
 *
 * It paints in a colour of its own, not the theme's primary: a selected
 * option on the same page (the update channel, the check tier) is the
 * primary too, and the one action on the page must not read as one more
 * selected state. The colour is the seed; each theme's algorithm shades
 * it — hover, pressed, its dark step — the way it shades the primary.
 */

import { Button, type ButtonProps, ConfigProvider } from 'antd';
import type React from 'react';

/** A dark orange: white text on it reads about as well as on the default primary. */
export const UPDATE_ACTION_COLOR = '#d46b08';

const UPDATE_ACTION_THEME = { token: { colorPrimary: UPDATE_ACTION_COLOR } };

const UpdateActionButton: React.FC<Omit<ButtonProps, 'type' | 'color' | 'variant'>> = (props) => (
  <ConfigProvider theme={UPDATE_ACTION_THEME}>
    <Button type="primary" {...props} />
  </ConfigProvider>
);

export default UpdateActionButton;
