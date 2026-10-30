def settled(page):
    """Wait for real font/finite motion completion; visibility alone permits mid-fade captures."""
    page.evaluate('''async () => {
      await document.fonts.ready;
      for (let pass = 0; pass < 3; pass++) {
        const active = document.getAnimations().filter(a => a.playState === 'running' && Number.isFinite(a.effect.getComputedTiming().endTime));
        if (!active.length) break;
        await Promise.all(active.map(a => a.finished.catch(() => {})));
      }
    }''')
