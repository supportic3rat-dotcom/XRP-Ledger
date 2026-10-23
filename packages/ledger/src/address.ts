/** Classic XRP Ledger address: "r" + base58 (Ripple alphabet), 25–35 characters. */
export const XRPL_ADDRESS = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;
export const isXrplAddress = (value: string): boolean => XRPL_ADDRESS.test(value.trim());
export const DESTINATION_TAG = /^\d{1,10}$/;
export const isDestinationTag = (value: string): boolean => DESTINATION_TAG.test(value) && Number(value) <= 4_294_967_295;
/** "rExtProt…ZwZ2" style shortening used across the design. */
export const shortAddress = (address: string, head = 8, tail = 6): string =>
  address.length > head + tail + 1 ? `${address.slice(0, head)}…${address.slice(-tail)}` : address;
