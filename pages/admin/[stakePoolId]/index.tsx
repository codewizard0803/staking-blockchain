/* eslint-disable jsx-a11y/label-has-associated-control */
import { findAta } from '@cardinal/common'
import { RewardDistributorKind } from '@cardinal/staking/dist/cjs/programs/rewardDistributor'
import { getRewardEntry } from '@cardinal/staking/dist/cjs/programs/rewardDistributor/accounts'
import { findRewardEntryId } from '@cardinal/staking/dist/cjs/programs/rewardDistributor/pda'
import { findStakeEntryIdFromMint } from '@cardinal/staking/dist/cjs/programs/stakePool/utils'
import { Tooltip } from '@mui/material'
import * as splToken from '@solana/spl-token'
import { useWallet } from '@solana/wallet-adapter-react'
import { Keypair, PublicKey } from '@solana/web3.js'
import { AsyncButton } from 'common/Button'
import { Footer } from 'common/Footer'
import { Header } from 'common/Header'
import { notify } from 'common/Notification'
import { ShortPubKeyUrl } from 'common/Pubkeys'
import {
  getMintDecimalAmountFromNatural,
  tryFormatInput,
  tryParseInput,
} from 'common/units'
import { pubKeyUrl, shortPubKey, tryPublicKey } from 'common/utils'
import { bnValidationTest, StakePoolForm } from 'components/StakePoolForm'
import { useFormik } from 'formik'
import { useHandleAuthorizeMints } from 'handlers/useHandleAuthorizeMints'
import { useHandleReclaimFunds } from 'handlers/useHandleReclaimFunds'
import { useHandleSetMultipliers } from 'handlers/useHandleSetMultipliers'
import { useHandleUpdatePool } from 'handlers/useHandleUpdatePool'
import { useRewardDistributorData } from 'hooks/useRewardDistributorData'
import { useRewardDistributorTokenAccount } from 'hooks/useRewardDistributorTokenAccount'
import { useRewardMintInfo } from 'hooks/useRewardMintInfo'
import { useStakePoolData } from 'hooks/useStakePoolData'
import { useStakePoolMetadata } from 'hooks/useStakePoolMetadata'
import Head from 'next/head'
import { useEnvironmentCtx } from 'providers/EnvironmentProvider'
import { useMemo, useState } from 'react'
import { TailSpin } from 'react-loader-spinner'
import * as Yup from 'yup'

const publicKeyValidationTest = (value: string | undefined): boolean => {
  return tryPublicKey(value) ? true : false
}

const creationFormSchema = Yup.object({
  multipliers: Yup.array().of(
    Yup.string().test(
      'is-public-key',
      'Invalid collection address',
      publicKeyValidationTest
    )
  ),
  multiplierMints: Yup.array().of(
    Yup.string().test(
      'is-public-key',
      'Invalid collection address',
      publicKeyValidationTest
    )
  ),
  reclaimAmount: Yup.string()
    .optional()
    .test('is-valid-bn', 'Invalid reclaim funds amount', bnValidationTest),
})
export type MultipliersForm = Yup.InferType<typeof creationFormSchema>

function AdminStakePool() {
  const wallet = useWallet()
  const { connection, environment } = useEnvironmentCtx()
  const stakePool = useStakePoolData()
  const rewardDistributor = useRewardDistributorData()
  const [mintsToAuthorize, setMintsToAuthorize] = useState<string>('')
  const [loadingLookupMultiplier, setLoadingLookupMultiplier] =
    useState<boolean>(false)
  const [loadingRewardAta, setLoadingRewardAta] = useState<boolean>(false)
  const [multiplierFound, setMultiplierFound] = useState<string>('')
  const rewardMintInfo = useRewardMintInfo()
  const [mintInfo, setMintInfo] = useState<splToken.MintInfo>()
  const { data: stakePoolMetadata } = useStakePoolMetadata()
  const handleAuthorizeMints = useHandleAuthorizeMints()
  const handleSetMultipliers = useHandleSetMultipliers()
  const handleUpdatePool = useHandleUpdatePool()
  const handleReclaimFunds = useHandleReclaimFunds()

  const initialValues: MultipliersForm = {
    multipliers: [''],
    multiplierMints: [''],
    reclaimAmount: '0',
  }
  const formState = useFormik({
    initialValues,
    onSubmit: (values) => {},
    validationSchema: creationFormSchema,
  })
  const { values, setFieldValue } = formState

  const handleLookupMultiplier = async (mintToLookup: string) => {
    setLoadingLookupMultiplier(true)
    try {
      if (!wallet?.connected) {
        throw 'Wallet not connected'
      }
      if (!stakePool.data) {
        throw 'Stake pool not found'
      }
      if (!rewardDistributor.data) {
        throw 'Reward Distributor not found'
      }
      const mintId = new PublicKey(mintToLookup)
      let stakeEntryId: PublicKey
      try {
        const temp = await findStakeEntryIdFromMint(
          connection,
          wallet.publicKey!,
          stakePool.data!.pubkey,
          mintId
        )
        stakeEntryId = temp[0]
      } catch (e) {
        throw 'Invalid mint ID or no reward entry for mint'
      }
      const [rewardEntryId] = await findRewardEntryId(
        rewardDistributor.data.pubkey,
        stakeEntryId
      )
      const rewardEntryData = await getRewardEntry(connection, rewardEntryId)
      setMultiplierFound(
        (
          rewardEntryData.parsed.multiplier.toNumber() /
          10 ** rewardDistributor.data.parsed.multiplierDecimals
        ).toString()
      )
    } catch (e) {
      setMultiplierFound('')
      notify({
        message: `${e}`,
        type: 'error',
      })
    } finally {
      setLoadingLookupMultiplier(false)
    }
  }

  useMemo(async () => {}, [values.reclaimAmount?.toString()])

  return (
    <div>
      <Head>
        <title>
          {`${
            stakePoolMetadata ? stakePoolMetadata.displayName : 'Cardinal'
          } Staking UI`}
        </title>
        <meta name="description" content="Generated by Cardinal Staking UI" />
        <link
          rel="icon"
          href={stakePoolMetadata ? stakePoolMetadata.imageUrl : `/favicon.ico`}
        />
        <script
          defer
          data-domain="stake.cardinal.so"
          src="https://plausible.io/js/plausible.js"
        ></script>
      </Head>

      <Header />
      <div className="container mx-auto w-full bg-[#1a1b20]">
        <div className="my-2 h-full min-h-[55vh] rounded-md bg-white bg-opacity-5 p-10 text-gray-200">
          {!stakePool.isFetched || !rewardDistributor.isFetched ? (
            <div className="h-[40vh] w-full animate-pulse rounded-md bg-white bg-opacity-10"></div>
          ) : stakePool.data ? (
            <div className="grid h-full grid-cols-2 gap-4 ">
              <div>
                <p className="text-lg font-bold">Update Staking Pool</p>
                <p className="mt-1 mb-2 text-sm">
                  All parameters for staking pool are optional and pre-filled
                  with existing values for ease of use.
                </p>
                <StakePoolForm
                  type="update"
                  handleSubmit={(d) => handleUpdatePool.mutate({ values: d })}
                  stakePoolData={stakePool.data}
                  rewardDistributorData={rewardDistributor.data}
                />
                <div className="mt-2 italic">
                  NOTE: Changing <strong>rewardAmount</strong>/
                  <strong>rewardDurationSeconds</strong> will affect the
                  distribution for currently staked and not-yet claimed rewards
                  to this new rate.
                  <br></br>
                  Changing <strong>multiplierDecimals</strong> will apply these
                  decimals to all existing multipliers.<br></br>
                  Changing <strong>defaultMultiplier</strong> will only apply to
                  new reward entries being created.
                </div>
              </div>
              <div>
                <p className="text-lg font-bold">Current Staking Pool</p>
                <p className="mt-1 mb-5 text-sm">
                  The parameters currently in place for the stake pool
                </p>
                {stakePool.isFetched ? (
                  <>
                    <span className="flex w-full flex-wrap md:mb-0">
                      <label className="inline-block text-sm font-bold uppercase tracking-wide text-gray-200">
                        Overlay Text:
                      </label>
                      <label className="inline-block pl-2">
                        {stakePool.data?.parsed.overlayText || '[None]'}
                      </label>
                    </span>
                    <span className="mt-3 flex w-full flex-wrap md:mb-0">
                      <label className="inline-block text-sm font-bold uppercase tracking-wide text-gray-200">
                        Collection Addresses:
                      </label>
                      <label className="inline-block pl-2">
                        {stakePool.data?.parsed.requiresCollections &&
                        stakePool.data?.parsed.requiresCollections.length !== 0
                          ? stakePool.data?.parsed.requiresCollections.map(
                              (collection) => (
                                <ShortPubKeyUrl
                                  key={collection.toString()}
                                  pubkey={collection}
                                  cluster={environment.label}
                                  className="pr-2 text-sm text-white"
                                />
                              )
                            )
                          : '[None]'}
                      </label>
                    </span>
                    <span className="mt-3 flex w-full flex-wrap md:mb-0">
                      <label className="inline-block text-sm font-bold uppercase tracking-wide text-gray-200">
                        Creator Addresses:
                      </label>
                      <label className="inline-block pl-2 text-white">
                        {stakePool.data?.parsed.requiresCreators &&
                        stakePool.data?.parsed.requiresCreators.length !== 0
                          ? stakePool.data?.parsed.requiresCreators.map(
                              (creator) => (
                                <ShortPubKeyUrl
                                  key={creator.toString()}
                                  pubkey={creator}
                                  cluster={environment.label}
                                  className="pr-2 text-sm font-bold underline underline-offset-2"
                                />
                              )
                            )
                          : '[None]'}
                      </label>
                    </span>
                    <span className="mt-3 flex w-full flex-wrap md:mb-0">
                      <label className="inline-block text-sm font-bold uppercase tracking-wide text-gray-200">
                        Requires Authorization:{' '}
                        {stakePool.data?.parsed.requiresAuthorization.toString() ||
                          '[None]'}
                      </label>
                    </span>
                    <span className="mt-3 flex w-full flex-wrap md:mb-0">
                      <label className="inline-block text-sm font-bold uppercase tracking-wide text-gray-200">
                        Cooldown Period Seconds:{' '}
                        {stakePool.data?.parsed.cooldownSeconds || '[None]'}
                      </label>
                    </span>
                    <span className="mt-3 flex w-full flex-wrap md:mb-0">
                      <label className="inline-block text-sm font-bold uppercase tracking-wide text-gray-200">
                        Minimum Stake Seconds:{' '}
                        {stakePool.data?.parsed.minStakeSeconds || '[None]'}
                      </label>
                    </span>
                    <span className="mt-3 flex w-full flex-wrap md:mb-0">
                      <label className="inline-block text-sm font-bold uppercase tracking-wide text-gray-200">
                        End Date:{' '}
                        {stakePool.data?.parsed.endDate
                          ? new Date(
                              stakePool.data?.parsed.endDate?.toNumber() * 1000
                            ).toDateString()
                          : '[None]'}
                      </label>
                    </span>
                    {rewardDistributor.data && (
                      <>
                        <span className="mt-3 flex w-full flex-wrap md:mb-0">
                          <Tooltip
                            title={'Use to add more funds to reward ditributor'}
                            placement="right"
                          >
                            <label className="inline-block text-sm font-bold uppercase tracking-wide text-gray-200">
                              Reward Distributor:{' '}
                              <a
                                target={'_blank'}
                                className="underline underline-offset-2"
                                href={pubKeyUrl(
                                  rewardDistributor.data.pubkey,
                                  environment.label
                                )}
                                rel="noreferrer"
                              >
                                {shortPubKey(rewardDistributor.data.pubkey)}
                              </a>{' '}
                            </label>
                          </Tooltip>
                        </span>
                        <span className="mt-3 flex w-full flex-wrap md:mb-0">
                          <label className="inline-block text-sm font-bold uppercase tracking-wide text-gray-200">
                            Reward Duration Seconds:{' '}
                            {rewardDistributor.data.parsed.rewardDurationSeconds.toString() ||
                              '[None]'}
                          </label>
                        </span>
                        <span className="mt-3 flex w-full flex-wrap md:mb-0">
                          <label className="inline-block text-sm font-bold uppercase tracking-wide text-gray-200">
                            Reward Amount:{' '}
                            {rewardDistributor.data.parsed.rewardAmount &&
                            rewardMintInfo.data
                              ? getMintDecimalAmountFromNatural(
                                  rewardMintInfo.data?.mintInfo,
                                  rewardDistributor.data.parsed.rewardAmount
                                ).toNumber()
                              : '[None]'}
                          </label>
                        </span>
                        <span className="mt-3 flex w-full flex-wrap md:mb-0">
                          <label className="inline-block text-sm font-bold uppercase tracking-wide text-gray-200">
                            Maximum reward seconds:{' '}
                            {rewardDistributor.data.parsed.maxRewardSecondsReceived?.toString() ||
                              '[None]'}
                          </label>
                        </span>
                        <span className="mt-3 flex w-full flex-wrap md:mb-0">
                          <label className="inline-block text-sm font-bold uppercase tracking-wide text-gray-200">
                            Default Multiplier:{' '}
                            {rewardDistributor.data.parsed.defaultMultiplier.toNumber() ||
                              '[None]'}
                          </label>
                        </span>
                        <span className="mt-3 flex w-full flex-wrap md:mb-0">
                          <label className="inline-block text-sm font-bold uppercase tracking-wide text-gray-200">
                            Multiplier Decimals:{' '}
                            {rewardDistributor.data.parsed.multiplierDecimals ||
                              '[None]'}
                          </label>
                        </span>
                      </>
                    )}
                  </>
                ) : (
                  <div className="relative flex h-8 w-full items-center justify-center">
                    <span className="text-gray-500"></span>
                    <div className="absolute w-full animate-pulse items-center justify-center rounded-lg bg-white bg-opacity-10 p-5"></div>
                  </div>
                )}
                {rewardDistributor.data && (
                  <div className="mt-10">
                    {rewardDistributor.data.parsed.kind ===
                      RewardDistributorKind.Treasury && (
                      <>
                        <label
                          className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-200"
                          htmlFor="require-authorization"
                        >
                          Reclaim Funds
                        </label>
                        <div className="mb-5 flex flex-row">
                          <div
                            className={`flex w-1/4 appearance-none justify-between rounded border border-gray-500 bg-gray-700 py-2 px-4 leading-tight text-gray-200 placeholder-gray-500 focus:bg-gray-800`}
                          >
                            <input
                              className={`mr-5 w-full bg-transparent focus:outline-none`}
                              type="text"
                              placeholder={'1000000'}
                              value={tryFormatInput(
                                values.reclaimAmount,
                                mintInfo?.decimals || 0,
                                '0'
                              )}
                              onChange={(e) => {
                                const value = Number(e.target.value)
                                if (Number.isNaN(value)) {
                                  notify({
                                    message: `Invalid reclaim amount`,
                                    type: 'error',
                                  })
                                  return
                                }
                                setFieldValue(
                                  'reclaimAmount',
                                  tryParseInput(
                                    e.target.value,
                                    mintInfo?.decimals || 0,
                                    values.reclaimAmount ?? ''
                                  )
                                )
                              }}
                            />
                            <div
                              className="flex h-full cursor-pointer items-center justify-center"
                              onClick={async () => {
                                setLoadingRewardAta(true)
                                const mint = new PublicKey(
                                  rewardDistributor.data!.parsed.rewardMint
                                )
                                const checkMint = new splToken.Token(
                                  connection,
                                  mint,
                                  splToken.TOKEN_PROGRAM_ID,
                                  Keypair.generate() // unused
                                )
                                const mintInfo = await checkMint.getMintInfo()
                                setMintInfo(mintInfo)
                                const mintAta = await findAta(
                                  rewardDistributor.data!.parsed.rewardMint,
                                  rewardDistributor.data!.pubkey,
                                  true
                                )
                                const ata = await checkMint.getAccountInfo(
                                  mintAta
                                )
                                setFieldValue(
                                  'reclaimAmount',
                                  ata.amount.toString()
                                )
                                setLoadingRewardAta(false)
                              }}
                            >
                              Max
                            </div>
                          </div>
                          <AsyncButton
                            className="ml-5"
                            disabled={loadingRewardAta}
                            loading={handleReclaimFunds.isLoading}
                            inlineLoader
                            onClick={() =>
                              handleReclaimFunds.mutate({
                                reclaimAmount: values.reclaimAmount,
                              })
                            }
                          >
                            Reclaim Funds
                          </AsyncButton>
                        </div>
                      </>
                    )}
                    <div className="mb-5">
                      <label
                        className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-200"
                        htmlFor="require-authorization"
                      >
                        Look up reward multiplier for mint
                      </label>
                      <input
                        className="mb-3 w-3/5 appearance-none flex-col rounded border border-gray-500 bg-gray-700 py-3 px-4 leading-tight text-gray-200 placeholder-gray-500 focus:bg-gray-800 focus:outline-none"
                        type="text"
                        placeholder={'Enter Mint ID'}
                        onChange={(e) => {
                          if (e.target.value.length !== 0) {
                            handleLookupMultiplier(e.target.value)
                          } else {
                            setMultiplierFound('')
                          }
                        }}
                      />
                      <span className="ml-10 inline-block">
                        {loadingLookupMultiplier && (
                          <TailSpin color="#fff" height={20} width={20} />
                        )}
                        {multiplierFound && (
                          <span className="text-md border px-4 py-2 font-semibold">
                            {multiplierFound}x
                          </span>
                        )}
                      </span>
                    </div>
                    <label
                      className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-200"
                      htmlFor="require-authorization"
                    >
                      Set multiplier for given mints
                    </label>
                    <p className="text-sm italic text-gray-300">
                      Set the stake multiplier for given mints.
                      <br />
                      For a 1x multiplier, enter value{' '}
                      {10 ** rewardDistributor.data.parsed.multiplierDecimals},
                      for a 2x multiplier enter value{' '}
                      {2 *
                        10 **
                          rewardDistributor.data.parsed.multiplierDecimals}{' '}
                      ...
                    </p>
                    <p className="text-sm italic text-gray-300">
                      For decimal multipliers, work with the reward distributor
                      {"'"}s <b>multiplierDecimals</b>. If you set
                      multiplierDecimals = 1, then for 1.5x multiplier, enter
                      value 15 so that value/10**multiplierDecimals = 15/10^1 =
                      1.5
                    </p>
                    <p className="mt-2 text-sm italic text-gray-300">
                      <b>NOTE</b> that for 1.5x, you could set
                      multiplierDecimals = 2 and enter value 150, or
                      multiplierDecimals = 3 and enter value 1500 ...
                    </p>
                    <p className="mt-2 mb-5 text-sm italic text-gray-300">
                      <b>WARNING</b> Do not set more than a few at at time. If
                      needed take a look at the scripts in{' '}
                      <a
                        href="https://github.com/cardinal-labs/cardinal-staking/tree/main/tools"
                        className="text-blue-500"
                        target="_blank"
                        rel="noreferrer"
                      >
                        tools
                      </a>{' '}
                      to set many at a time.
                    </p>
                    <span className="flex flex-row gap-5">
                      <input
                        className="mb-3 w-1/6 appearance-none flex-col rounded border border-gray-500 bg-gray-700 py-3 px-4 leading-tight text-gray-200 placeholder-gray-500 focus:bg-gray-800 focus:outline-none"
                        type="text"
                        placeholder={'0'}
                        onChange={(e) => {
                          setFieldValue('multipliers[0]', e.target.value)
                        }}
                      />
                      <div
                        className={`mb-3 flex w-full appearance-none justify-between rounded border border-gray-500 bg-gray-700 py-3 px-4 leading-tight text-gray-200 placeholder-gray-500 focus:bg-gray-800`}
                      >
                        <input
                          className={`mr-5 w-full bg-transparent focus:outline-none`}
                          type="text"
                          autoComplete="off"
                          onChange={(e) => {
                            setFieldValue('multiplierMints[0]', e.target.value)
                          }}
                          placeholder={'CmAy...A3fD'}
                          name="requireCollections"
                        />
                        <div
                          className="cursor-pointer text-xs text-gray-400"
                          onClick={() => {
                            setFieldValue(`multiplierMints`, [
                              '',
                              ...values.multiplierMints!,
                            ])
                            setFieldValue(`multipliers`, [
                              '',
                              ...values.multipliers!,
                            ])
                          }}
                        >
                          Add
                        </div>
                      </div>
                    </span>
                    {values.multiplierMints!.map(
                      (v, i) =>
                        i > 0 && (
                          <span className="flex flex-row gap-5">
                            <input
                              className="mb-3 w-1/6 appearance-none flex-col rounded border border-gray-500 bg-gray-700 py-3 px-4 leading-tight text-gray-200 placeholder-gray-500 focus:bg-gray-800 focus:outline-none"
                              type="text"
                              placeholder={'0'}
                              onChange={(e) => {
                                setFieldValue(
                                  `multipliers[${i}]`,
                                  e.target.value
                                )
                              }}
                            />
                            <div
                              className={`mb-3 flex w-full appearance-none justify-between rounded border border-gray-500 bg-gray-700 py-3 px-4 leading-tight text-gray-200 placeholder-gray-500 focus:bg-gray-800`}
                            >
                              <input
                                className={`mr-5 w-full bg-transparent focus:outline-none`}
                                type="text"
                                autoComplete="off"
                                onChange={(e) => {
                                  setFieldValue(
                                    `multiplierMints[${i}]`,
                                    e.target.value
                                  )
                                }}
                                placeholder={'CmAy...A3fD'}
                                name="requireCollections"
                              />
                              <div
                                className="cursor-pointer text-xs text-gray-400"
                                onClick={() => {
                                  setFieldValue(
                                    `multiplierMints`,
                                    values.multiplierMints!.filter(
                                      (_, ix) => ix !== i
                                    )
                                  )
                                  setFieldValue(
                                    `multipliers`,
                                    values.multipliers!.filter(
                                      (_, ix) => ix !== i
                                    )
                                  )
                                }}
                              >
                                Remove
                              </div>
                            </div>
                          </span>
                        )
                    )}
                    <AsyncButton
                      loading={handleSetMultipliers.isLoading}
                      onClick={() =>
                        handleSetMultipliers.mutate({
                          multiplierMints: values.multiplierMints,
                          multipliers: values.multipliers,
                        })
                      }
                      inlineLoader
                      className="w-max"
                    >
                      Set Multipliers
                    </AsyncButton>
                  </div>
                )}
                {stakePool.data?.parsed.requiresAuthorization && (
                  <div className="mt-5">
                    <label
                      className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-200"
                      htmlFor="require-authorization"
                    >
                      Authorize access to specific mint
                    </label>
                    <p className="mb-2 text-sm italic text-gray-300">
                      Allow any specific mints access to the stake pool
                      (separated by commas)
                    </p>
                    <p className="mb-5 text-sm italic text-gray-300">
                      <b>WARNING</b> Do not set more than a few at at time. If
                      needed take a look at the scripts in{' '}
                      <a
                        href="https://github.com/cardinal-labs/cardinal-staking/tree/main/tools"
                        className="text-blue-500"
                        target="_blank"
                        rel="noreferrer"
                      >
                        tools
                      </a>{' '}
                      to set many at a time.
                    </p>
                    <input
                      className="mb-3 block w-full appearance-none rounded border border-gray-500 bg-gray-700 py-3 px-4 leading-tight text-gray-200 placeholder-gray-500 focus:bg-gray-800 focus:outline-none"
                      type="text"
                      placeholder={'Cmwy..., A3fD..., 7Y1v...'}
                      value={mintsToAuthorize}
                      onChange={(e) => {
                        setMintsToAuthorize(e.target.value)
                      }}
                    />
                    <AsyncButton
                      loading={handleAuthorizeMints.isLoading}
                      onClick={() =>
                        handleAuthorizeMints.mutate({
                          mintsToAuthorize,
                        })
                      }
                      inlineLoader
                      className="w-max"
                    >
                      Authorize Mints
                    </AsyncButton>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="w-full text-center text-gray-500">
              No stake pool found
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  )
}

export default AdminStakePool
