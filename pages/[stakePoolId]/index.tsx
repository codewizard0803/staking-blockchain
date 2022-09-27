import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { defaultSecondaryColor } from 'api/mapping'
import { contrastify } from 'common/colors'
import { Footer } from 'common/Footer'
import { FooterSlim } from 'common/FooterSlim'
import { Header } from 'common/Header'
import { HeroLarge } from 'common/HeroLarge'
import { Info } from 'common/Info'
import { contrastColorMode } from 'common/utils'
import { PerformanceStats } from 'components/PerformanceStats'
import { PoolAnalytics } from 'components/PoolAnalytics'
import { StakedTokens } from 'components/StakedTokens'
import { UnstakedTokens } from 'components/UnstakedTokens'
import { useRewardDistributorData } from 'hooks/useRewardDistributorData'
import { useStakedTokenDatas } from 'hooks/useStakedTokenDatas'
import { useStakePoolData } from 'hooks/useStakePoolData'
import { useStakePoolMetadata } from 'hooks/useStakePoolMetadata'
import { useUserRegion } from 'hooks/useUserRegion'
import Head from 'next/head'
import { useRouter } from 'next/router'

function StakePoolHome() {
  const router = useRouter()
  const wallet = useWallet()
  const walletModal = useWalletModal()
  const { data: stakePool, isFetched: stakePoolLoaded } = useStakePoolData()
  const userRegion = useUserRegion()
  const rewardDistributorData = useRewardDistributorData()
  const stakedTokenDatas = useStakedTokenDatas()

  const { data: stakePoolMetadata } = useStakePoolMetadata()

  if (stakePoolMetadata?.redirect) {
    router.push(stakePoolMetadata?.redirect)
    return <></>
  }

  if (
    !stakePoolLoaded ||
    (stakePoolMetadata?.disallowRegions && !userRegion.isFetched)
  ) {
    return <></>
  }

  if (stakePoolMetadata?.disallowRegions && !userRegion.data?.isAllowed) {
    return (
      <div
        className="flex min-h-screen flex-col"
        style={{
          background: stakePoolMetadata?.colors?.primary,
          backgroundImage: `url(${stakePoolMetadata?.backgroundImage})`,
        }}
      >
        <Header />
        <div className="max flex grow items-center justify-center">
          <div className="w-[600px] max-w-[95vw] rounded-xl bg-black bg-opacity-50 p-10 text-center">
            <div className="text-2xl font-bold">
              Users from Country ({userRegion.data?.countryName}) are not
              Eligible to Participate
            </div>
            <div className="mt-8 text-sm text-light-2">
              It is prohibited to use certain services offered by Parcl if you
              are a resident of, or are located, incorporated, or have a
              registered agent in, {userRegion.data?.countryName} or any other
              jurisdiction where the Services are restricted.
            </div>
          </div>
        </div>
        <FooterSlim />
      </div>
    )
  }

  return (
    <div
      style={{
        background: stakePoolMetadata?.colors?.primary,
        backgroundImage: `url(${stakePoolMetadata?.backgroundImage})`,
      }}
    >
      <Head>
        <title>{stakePoolMetadata?.displayName ?? 'Cardinal Staking UI'}</title>
        <meta name="description" content="Generated by Cardinal Staking UI" />
        <link rel="icon" href={stakePoolMetadata?.imageUrl ?? `/favicon.ico`} />
        <script
          defer
          data-domain="stake.cardinal.so"
          src="https://plausible.io/js/plausible.js"
        ></script>
      </Head>
      <Header />
      <div
        className="relative z-0 mx-10 mt-4 flex flex-col gap-4"
        style={{
          ...stakePoolMetadata?.styles,
          color:
            stakePoolMetadata?.colors?.fontColor ??
            contrastColorMode(
              stakePoolMetadata?.colors?.primary || '#000000'
            )[0],
        }}
      >
        {(!stakePool && stakePoolLoaded) || stakePoolMetadata?.notFound ? (
          <div
            className="mx-5 mb-5 rounded-md border-[1px] bg-opacity-40 p-4 text-center text-lg font-semibold"
            style={{
              background:
                stakePoolMetadata?.colors?.secondary || defaultSecondaryColor,
              color: stakePoolMetadata?.colors?.fontColor,
              borderColor: contrastify(
                0.5,
                stakePoolMetadata?.colors?.secondary || defaultSecondaryColor
              ),
            }}
          >
            Stake pool not found
          </div>
        ) : (
          !wallet.connected && (
            <div
              className={`mx-5 mb-5 cursor-pointer rounded-md border-[1px]  p-4 text-center text-lg font-semibold ${
                stakePoolMetadata?.colors?.accent &&
                stakePoolMetadata?.colors.fontColor
                  ? ''
                  : 'border-yellow-500 bg-yellow-500 bg-opacity-40'
              }`}
              style={
                stakePoolMetadata?.colors?.accent &&
                stakePoolMetadata?.colors.fontColor
                  ? {
                      background: stakePoolMetadata?.colors?.secondary,
                      borderColor: stakePoolMetadata?.colors?.accent,
                      color:
                        stakePoolMetadata?.colors?.fontColorSecondary ||
                        stakePoolMetadata?.colors?.fontColor,
                    }
                  : {}
              }
              onClick={() => walletModal.setVisible(true)}
            >
              Connect wallet to continue
            </div>
          )
        )}
        <HeroLarge />
        {!!rewardDistributorData.data && !!stakedTokenDatas.data?.length && (
          <Info
            colorized
            icon="performance"
            header="Personal Charts"
            description="View your recent performance"
            content={
              <div className="flex grow items-center justify-end">
                <PerformanceStats />
              </div>
            }
          />
        )}
        <PoolAnalytics />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <UnstakedTokens />
          <StakedTokens />
        </div>
      </div>
      {!stakePoolMetadata?.hideFooter ? (
        <Footer bgColor={stakePoolMetadata?.colors?.primary} />
      ) : (
        <div className="h-24"></div>
      )}
    </div>
  )
}

export default StakePoolHome
