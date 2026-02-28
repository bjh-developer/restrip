module.exports = {
  ci: {
    collect: {
      numberOfRuns: 1,
    },
    assert: {
      assertions: {
        // Start with warn on everything — tighten to error once you know your baseline
        "categories:performance": ["warn", { minScore: 0.7 }],
        "categories:accessibility": ["error", { minScore: 0.9 }], // accessibility is non-negotiable
        "categories:best-practices": ["warn", { minScore: 0.8 }],
        "categories:seo": ["warn", { minScore: 0.8 }],
      },
    },
    upload: {
      target: "temporary-public-storage", // free, hosted by Google — results expire after 7 days
    },
  },
};
