/**
 * Schema barrel — importing this file executes every category's
 * registration side effects. The SettingsProvider imports this once
 * at app mount; tests can import it to seed the registry.
 *
 * Adding a new category:
 *   1. Create schema/<category>.ts with registerSetting calls
 *   2. Add a registerCategory entry in ../categories.tsx
 *   3. Import the new file here
 */

import '../categories';
import './general';
import './appearance';
import './workspace-layout';
import './devpanel-layout';
import './devpanel-headers';
import './devpanel-initiator';
import './devpanel-cookies';
import './devpanel-timing';
import './devpanel-network';
import './inspection';
import './editor';
import './requests';
import './rules-engine';
import './backend';
import './mcp';
import './keyboard';
import './keyboard-popup';
import './workspace-sharing';
import './data';
import './about';
