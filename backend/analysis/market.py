MARKET_CAGR  = 0.085
MARKET_LABEL = "S&P 500 50-yr historical avg (~8.5%/yr)"


def get_market_cagr() -> tuple[float, str]:
    return MARKET_CAGR, MARKET_LABEL
