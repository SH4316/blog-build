import type { MermaidConfig } from 'mermaid';

export interface DiagramTheme {
  dark: boolean;
  background: string;
  text: string;
  muted: string;
  accent: string;
  selected: string;
  surface: string;
  fontFamily: string;
}

let library: Promise<typeof import('mermaid')> | undefined;
let pending: Promise<unknown> = Promise.resolve();
let sequence = 0;

export function renderDiagram(source: string, theme: DiagramTheme): Promise<string> {
  const result = pending.then(async () => {
    library ??= import('mermaid').catch((error) => {
      library = undefined;
      throw error;
    });
    const mermaid = (await library).default;
    const config: MermaidConfig = {
      startOnLoad: false,
      securityLevel: 'strict',
      suppressErrorRendering: true,
      htmlLabels: false,
      maxTextSize: 50_000,
      maxEdges: 500,
      theme: 'base',
      fontFamily: theme.fontFamily,
      secure: [
        'secure',
        'securityLevel',
        'startOnLoad',
        'maxTextSize',
        'maxEdges',
        'suppressErrorRendering',
        'htmlLabels',
        'theme',
        'themeVariables',
        'themeCSS',
        'fontFamily',
      ],
      themeVariables: {
        darkMode: theme.dark,
        background: theme.background,
        primaryColor: theme.selected,
        primaryTextColor: theme.text,
        primaryBorderColor: theme.accent,
        secondaryColor: theme.surface,
        secondaryTextColor: theme.text,
        tertiaryColor: theme.surface,
        tertiaryTextColor: theme.text,
        lineColor: theme.muted,
        textColor: theme.text,
        mainBkg: theme.selected,
        nodeBorder: theme.accent,
        edgeLabelBackground: theme.background,
        actorBkg: theme.selected,
        actorBorder: theme.accent,
        actorTextColor: theme.text,
        signalColor: theme.muted,
        signalTextColor: theme.text,
        labelBoxBkgColor: theme.surface,
        labelBoxBorderColor: theme.accent,
        labelTextColor: theme.text,
        loopTextColor: theme.text,
        noteBkgColor: theme.surface,
        noteTextColor: theme.text,
        noteBorderColor: theme.accent,
        activationBkgColor: theme.selected,
        activationBorderColor: theme.accent,
        fontFamily: theme.fontFamily,
        fontSize: '14px',
      },
    };
    mermaid.initialize(config);
    const staging = document.createElement('div');
    staging.setAttribute('aria-hidden', 'true');
    staging.style.cssText = 'position:absolute;left:-100000px;top:0;pointer-events:none;';
    document.body.append(staging);
    try {
      const { svg } = await mermaid.render(`blog-diagram-${++sequence}`, source, staging);
      return svg;
    } finally {
      staging.remove();
    }
  });
  pending = result.catch(() => undefined);
  return result;
}
