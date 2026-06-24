import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type HostNode = {
  type: string;
  props: Record<string, any>;
  children: RenderedNode[];
};
type RenderedNode = HostNode | string | number | null;

const hooks = vi.hoisted(() => {
  let state: unknown[] = [];
  let cursor = 0;

  return {
    beginRender() {
      cursor = 0;
    },
    reset() {
      state = [];
      cursor = 0;
    },
    useState(initial: unknown) {
      const index = cursor;
      cursor += 1;
      if (state.length <= index) {
        state[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
      }
      const setState = (next: unknown) => {
        state[index] =
          typeof next === 'function' ? (next as (prev: unknown) => unknown)(state[index]) : next;
      };
      return [state[index], setState];
    },
  };
});

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useState: hooks.useState,
  };
});

vi.mock('vaul', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  const passthrough = (type: string) => {
    function MockVaulPart({ children, ...props }: { children?: any }) {
      return React.createElement(type, props, children);
    }
    MockVaulPart.displayName = `MockVaul${type}`;
    return MockVaulPart;
  };

  function MockDrawerRoot({ open, children }: { open: boolean; children?: any }) {
    return open ? React.createElement('div', { 'data-testid': 'drawer-root' }, children) : null;
  }
  MockDrawerRoot.displayName = 'MockDrawerRoot';

  return {
    Drawer: {
      Root: MockDrawerRoot,
      Portal: passthrough('div'),
      Overlay: passthrough('div'),
      Content: passthrough('section'),
      Title: passthrough('h2'),
    },
  };
});

vi.mock('@/components/icons/Icon', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  return {
    Icon: ({ name }: { name: string }) => React.createElement('span', { 'data-icon': name }),
  };
});

vi.mock('@/lib/store/toasts', () => ({
  useToasts: (selector: (state: { show: typeof mocks.showToast }) => unknown) =>
    selector({ show: mocks.showToast }),
}));

function isElement(value: unknown): value is { type: unknown; props: Record<string, any> } {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'type' in value &&
      'props' in value,
  );
}

function renderNode(node: unknown): RenderedNode[] {
  if (node == null || typeof node === 'boolean') return [];
  if (typeof node === 'string' || typeof node === 'number') return [node];
  if (Array.isArray(node)) return node.flatMap(renderNode);
  if (!isElement(node)) return [];

  const { type, props } = node;
  if (typeof type === 'function') {
    return renderNode(type(props));
  }
  if (typeof type !== 'string') {
    return renderNode(props.children);
  }

  return [
    {
      type,
      props,
      children: renderNode(props.children),
    },
  ];
}

function flatten(nodes: RenderedNode[]): HostNode[] {
  return nodes.flatMap((node) => {
    if (!node || typeof node !== 'object') return [];
    return [node, ...flatten(node.children)];
  });
}

function textOf(node: RenderedNode): string {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  return node.children.map(textOf).join('');
}

function findByText(nodes: RenderedNode[], text: string): HostNode {
  const match = flatten(nodes).find((node) => textOf(node).includes(text));
  if (!match) throw new Error(`Unable to find text: ${text}`);
  return match;
}

function findButton(nodes: RenderedNode[], text: string): HostNode {
  const match = flatten(nodes).find(
    (node) => node.type === 'button' && textOf(node).includes(text),
  );
  if (!match) throw new Error(`Unable to find button: ${text}`);
  return match;
}

function findTextarea(nodes: RenderedNode[]): HostNode {
  const match = flatten(nodes).find((node) => node.type === 'textarea');
  if (!match) throw new Error('Unable to find textarea');
  return match;
}

async function renderSheet(onOpenChange = vi.fn()) {
  const React = await import('react');
  const { FlagReviewSheet } = await import('@/components/review/FlagReviewSheet');
  hooks.beginRender();
  return {
    tree: renderNode(
      React.createElement(FlagReviewSheet, {
        open: true,
        onOpenChange,
        reviewId: 'review-065',
      }),
    ),
    onOpenChange,
  };
}

beforeEach(() => {
  hooks.reset();
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mocks.fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FlagReviewSheet', () => {
  it('posts the selected reason and notes to the review flag API', async () => {
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ id: 'flag-1' }), { status: 200 }));
    const onOpenChange = vi.fn();

    let { tree } = await renderSheet(onOpenChange);
    findButton(tree, 'Spam or advertising').props.onClick?.();
    tree = (await renderSheet(onOpenChange)).tree;
    findTextarea(tree).props.onChange?.({ target: { value: 'Promotional copy' } });
    tree = (await renderSheet(onOpenChange)).tree;

    await findButton(tree, 'Submit flag').props.onClick?.();

    expect(mocks.fetch).toHaveBeenCalledWith('/api/reviews/review-065/flag', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'spam', notes: 'Promotional copy' }),
    });
    expect(mocks.showToast).toHaveBeenCalledWith('Thanks — we\u2019ll review this flag', {
      tone: 'info',
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('keeps the sheet open and surfaces an error when flag submission fails', async () => {
    mocks.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'moderation queue unavailable' }), { status: 503 }),
    );
    const onOpenChange = vi.fn();

    let { tree } = await renderSheet(onOpenChange);
    findButton(tree, 'Offensive').props.onClick?.();
    tree = (await renderSheet(onOpenChange)).tree;
    findTextarea(tree).props.onChange?.({ target: { value: 'Contains abuse' } });
    tree = (await renderSheet(onOpenChange)).tree;

    await findButton(tree, 'Submit flag').props.onClick?.();
    tree = (await renderSheet(onOpenChange)).tree;

    expect(mocks.fetch).toHaveBeenCalledWith('/api/reviews/review-065/flag', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'offensive', notes: 'Contains abuse' }),
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(findByText(tree, 'moderation queue unavailable')).toBeTruthy();
  });
});
