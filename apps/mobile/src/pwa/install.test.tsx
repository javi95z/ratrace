import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { InstallApp, InstallProvider, useInstallOffer, ViewportSync } from './install';

/* The phone is installed already: install.tsx offers nothing, and the web's twin (install.web.tsx) is tested beside it. */

function Offer() {
  const offer = useInstallOffer();
  return <p>{offer.shown ? 'offer' : 'no offer'}</p>;
}

describe('installing on the phone', () => {
  it('offers nothing and draws only what it is given', () => {
    const html = renderToString(
      <InstallProvider>
        <ViewportSync />
        <InstallApp onDismiss={() => undefined} />
        <Offer />
        <b>the game</b>
      </InstallProvider>,
    );
    expect(html).toBe('<p>no offer</p><b>the game</b>');
  });

  it('has a no that does nothing', () => {
    let dismissed = false;
    function Press() {
      useInstallOffer().dismiss();
      dismissed = true;
      return null;
    }
    renderToString(<Press />);
    expect(dismissed).toBe(true);
  });
});
