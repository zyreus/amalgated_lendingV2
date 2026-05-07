/**
 * Lazy Amplify configuration for FaceLivenessDetector.
 *
 * Importing `aws-amplify` synchronously adds ~200–400 KB to the initial bundle.
 * Almost all sessions never reach the KYC liveness step, so we now defer the
 * import behind `ensureAmplifyConfigured()` and only the components that
 * actually mount the FaceLivenessDetector will pay that cost.
 *
 * Guest Cognito Identity Pool credentials are required for FaceLivenessDetector
 * (streams video to Rekognition). Create a pool in the same region as
 * LIVENESS_AMPLIFY_REGION and attach an IAM role with
 * rekognition:StartFaceLivenessSession (and related) permissions.
 */

let configurePromise = null
let configured = false

function readPoolId() {
  const raw = import.meta.env.VITE_AWS_COGNITO_IDENTITY_POOL_ID
  return typeof raw === 'string' ? raw.trim() : ''
}

export function isAmplifyConfigurable() {
  return readPoolId() !== ''
}

export function ensureAmplifyConfigured() {
  if (configured) return Promise.resolve(true)
  if (configurePromise) return configurePromise

  const poolId = readPoolId()
  if (!poolId) {
    configured = true
    return Promise.resolve(false)
  }

  configurePromise = import('aws-amplify')
    .then(({ Amplify }) => {
      Amplify.configure({
        Auth: {
          Cognito: {
            identityPoolId: poolId,
            allowGuestAccess: true,
          },
        },
      })
      configured = true
      return true
    })
    .catch((err) => {
      configurePromise = null
      console.error('[amplify] failed to configure Amplify lazily', err)
      return false
    })

  return configurePromise
}

export default ensureAmplifyConfigured
