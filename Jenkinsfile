// =============================================================================
// Hospital Management System - Jenkins CI/CD pipeline
//
// CI : checkout -> install -> lint -> test -> build -> docker build
// CD : docker push -> deploy -> health check
//
// No secret is ever written here. Everything sensitive is pulled from the
// Jenkins Credentials Manager at run time (see the README section in the
// project handover notes for the exact credential IDs).
// =============================================================================

pipeline {
  agent any

  options {
    timestamps()
    ansiColor('xterm')
    timeout(time: 30, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '20', artifactNumToKeepStr: '5'))
    disableConcurrentBuilds()
    skipDefaultCheckout(true)
  }

  triggers {
    // Fired by the GitHub webhook on every push (see setup notes).
    githubPush()
  }

  parameters {
    booleanParam(
      name: 'PUSH_IMAGES',
      defaultValue: true,
      description: 'Push built images to the container registry'
    )
    booleanParam(
      name: 'DEPLOY',
      defaultValue: true,
      description: 'Deploy after a successful build'
    )
    string(
      name: 'DEPLOY_ENVIRONMENT',
      defaultValue: 'staging',
      description: 'Target environment label'
    )
  }

  environment {
    // --- registry -----------------------------------------------------------
    DOCKER_REGISTRY   = 'docker.io'
    BACKEND_IMAGE     = 'hospital-management-backend'
    FRONTEND_IMAGE    = 'hospital-management-frontend'
    IMAGE_TAG         = "${env.BUILD_NUMBER}-${env.GIT_COMMIT ? env.GIT_COMMIT.take(7) : 'local'}"

    // --- deployment ---------------------------------------------------------
    DEPLOY_DIR        = '/opt/hospital-management-system'
    HEALTH_URL        = "${env.HEALTH_CHECK_URL ?: 'http://localhost:5000/api/health'}"
    HEALTH_RETRIES    = '20'
    HEALTH_DELAY      = '6'

    // --- build --------------------------------------------------------------
    NODE_ENV          = 'test'
    CI                = 'true'
  }

  stages {

    /* ------------------------------------------------------------ CHECKOUT */
    stage('Checkout') {
      steps {
        checkout scm
        script {
          env.GIT_COMMIT_SHORT = sh(
            script: 'git rev-parse --short HEAD', returnStdout: true
          ).trim()
          env.IMAGE_TAG = "${env.BUILD_NUMBER}-${env.GIT_COMMIT_SHORT}"
          currentBuild.displayName = "#${env.BUILD_NUMBER} · ${env.GIT_COMMIT_SHORT}"
        }
        sh 'git --no-pager log -1 --pretty="%h %an %s"'
      }
    }

    /* -------------------------------------------------- INSTALL DEPENDENCIES */
    stage('Install dependencies') {
      parallel {
        stage('Backend deps') {
          steps {
            dir('backend') {
              // npm ci fails the build on any lockfile mismatch.
              sh 'npm ci --no-audit --no-fund'
            }
          }
        }
        stage('Frontend deps') {
          steps {
            dir('frontend') {
              sh 'npm ci --no-audit --no-fund'
            }
          }
        }
      }
    }

    /* ---------------------------------------------------------------- LINT */
    stage('Lint') {
      parallel {
        stage('Backend lint') {
          steps {
            dir('backend') { sh 'npm run lint' }
          }
        }
        stage('Frontend lint') {
          steps {
            dir('frontend') { sh 'npm run lint' }
          }
        }
      }
    }

    /* --------------------------------------------------------------- TESTS */
    stage('Test') {
      environment {
        // Test-only secret; the suite runs against in-memory SQLite.
        JWT_SECRET         = 'jenkins-ci-test-secret'
        JWT_REFRESH_SECRET = 'jenkins-ci-test-refresh-secret'
      }
      steps {
        dir('backend') {
          // A non-zero exit here fails the build and blocks deployment.
          sh 'npm run test:coverage'
        }
      }
      post {
        always {
          junit allowEmptyResults: true, testResults: 'backend/junit.xml'
          publishHTML(target: [
            allowMissing         : true,
            alwaysLinkToLastBuild: true,
            keepAll              : true,
            reportDir            : 'backend/coverage/lcov-report',
            reportFiles          : 'index.html',
            reportName           : 'Backend coverage'
          ])
        }
      }
    }

    /* --------------------------------------------------------------- BUILD */
    stage('Build') {
      parallel {
        stage('Build backend') {
          steps {
            dir('backend') { sh 'npm run build' }
          }
        }
        stage('Build frontend') {
          steps {
            dir('frontend') { sh 'npm run build' }
          }
          post {
            success {
              archiveArtifacts artifacts: 'frontend/dist/**', fingerprint: true
            }
          }
        }
      }
    }

    /* ------------------------------------------------------- DOCKER BUILD */
    stage('Docker build') {
      steps {
        script {
          withCredentials([string(
            credentialsId: 'dockerhub-username',
            variable: 'DOCKER_USERNAME'
          )]) {
            env.BACKEND_REF  = "${DOCKER_USERNAME}/${BACKEND_IMAGE}"
            env.FRONTEND_REF = "${DOCKER_USERNAME}/${FRONTEND_IMAGE}"

            sh '''
              set -eu
              echo "Building ${BACKEND_REF}:${IMAGE_TAG}"
              docker build \
                -f backend/Dockerfile \
                -t "${BACKEND_REF}:${IMAGE_TAG}" \
                -t "${BACKEND_REF}:latest" \
                .

              echo "Building ${FRONTEND_REF}:${IMAGE_TAG}"
              docker build \
                -f frontend/Dockerfile \
                -t "${FRONTEND_REF}:${IMAGE_TAG}" \
                -t "${FRONTEND_REF}:latest" \
                ./frontend

              docker image inspect "${BACKEND_REF}:${IMAGE_TAG}"  > /dev/null
              docker image inspect "${FRONTEND_REF}:${IMAGE_TAG}" > /dev/null
            '''
          }
        }
      }
    }

    /* --------------------------------------------------------- DOCKER PUSH */
    stage('Docker push') {
      when {
        allOf {
          expression { params.PUSH_IMAGES }
          anyOf { branch 'main'; branch 'master' }
        }
      }
      steps {
        withCredentials([usernamePassword(
          credentialsId: 'docker-hub-credentials',
          usernameVariable: 'DOCKER_USERNAME',
          passwordVariable: 'DOCKER_PASSWORD'
        )]) {
          sh '''
            set -eu
            echo "${DOCKER_PASSWORD}" | docker login "${DOCKER_REGISTRY}" \
              -u "${DOCKER_USERNAME}" --password-stdin

            docker push "${DOCKER_USERNAME}/${BACKEND_IMAGE}:${IMAGE_TAG}"
            docker push "${DOCKER_USERNAME}/${BACKEND_IMAGE}:latest"
            docker push "${DOCKER_USERNAME}/${FRONTEND_IMAGE}:${IMAGE_TAG}"
            docker push "${DOCKER_USERNAME}/${FRONTEND_IMAGE}:latest"

            docker logout "${DOCKER_REGISTRY}"
          '''
        }
      }
      post {
        always {
          sh 'docker logout ${DOCKER_REGISTRY} || true'
        }
      }
    }

    /* -------------------------------------------------------------- DEPLOY */
    stage('Deploy') {
      when {
        allOf {
          expression { params.DEPLOY }
          anyOf { branch 'main'; branch 'master' }
        }
      }
      steps {
        withCredentials([
          string(credentialsId: 'hms-jwt-secret',          variable: 'JWT_SECRET'),
          string(credentialsId: 'hms-jwt-refresh-secret',  variable: 'JWT_REFRESH_SECRET'),
          string(credentialsId: 'hms-db-password',         variable: 'DB_PASSWORD'),
          string(credentialsId: 'hms-mysql-root-password', variable: 'MYSQL_ROOT_PASSWORD'),
          string(credentialsId: 'dockerhub-username',      variable: 'DOCKER_USERNAME')
        ]) {
          sh '''
            set -eu

            echo "Deploying ${IMAGE_TAG} to ${DEPLOY_ENVIRONMENT}"
            mkdir -p "${DEPLOY_DIR}"
            cp docker-compose.yml "${DEPLOY_DIR}/docker-compose.yml"

            # Runtime env file is written from Jenkins credentials and is never
            # committed. 600 so only the deploy user can read it.
            umask 077
            cat > "${DEPLOY_DIR}/.env" <<ENVFILE
NODE_ENV=production
DB_NAME=hospital_db
DB_USER=hms_user
DB_PASSWORD=${DB_PASSWORD}
MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
DOCKER_USERNAME=${DOCKER_USERNAME}
IMAGE_TAG=${IMAGE_TAG}
RUN_MIGRATIONS=true
RUN_SEEDERS=false
FRONTEND_PORT=3000
BACKEND_PORT=5000
MYSQL_PORT=3307
ENVFILE

            cd "${DEPLOY_DIR}"

            # 1. pull the freshly pushed images
            docker compose pull backend frontend || true

            # 2. stop the previous containers, 3. start the new ones,
            #    4. migrations run from the backend entrypoint
            docker compose up -d --remove-orphans

            docker compose ps
          '''
        }
      }
    }

    /* -------------------------------------------------------- HEALTH CHECK */
    stage('Health check') {
      when {
        allOf {
          expression { params.DEPLOY }
          anyOf { branch 'main'; branch 'master' }
        }
      }
      steps {
        sh '''
          set -eu

          echo "Verifying ${HEALTH_URL}"
          i=1
          while [ "$i" -le "${HEALTH_RETRIES}" ]; do
            BODY=$(curl -fsS --max-time 5 "${HEALTH_URL}" 2>/dev/null || true)

            case "${BODY}" in
              *'"status":"ok"'*)
                echo "Health check passed on attempt ${i}: ${BODY}"
                exit 0
                ;;
            esac

            echo "Attempt ${i}/${HEALTH_RETRIES} - not healthy yet, retrying in ${HEALTH_DELAY}s…"
            i=$((i + 1))
            sleep "${HEALTH_DELAY}"
          done

          echo "DEPLOYMENT FAILED: ${HEALTH_URL} never returned status=ok." >&2
          exit 1
        '''
      }
      post {
        failure {
          echo 'Health check failed - dumping container state for triage.'
          sh '''
            cd "${DEPLOY_DIR}" 2>/dev/null || exit 0
            docker compose ps      || true
            docker compose logs --tail=120 backend || true
            docker compose logs --tail=60  mysql   || true
          '''
        }
      }
    }
  }

  post {
    success {
      echo "BUILD SUCCESS - ${env.IMAGE_TAG} passed CI and the deployment health check."
    }
    failure {
      echo "BUILD FAILED at stage '${env.STAGE_NAME}' - no deployment was promoted."
    }
    unstable {
      echo 'BUILD UNSTABLE - review the test report.'
    }
    always {
      // Keep the agent clean; never leave dangling images between builds.
      sh 'docker image prune -f --filter "until=24h" || true'
      cleanWs(deleteDirs: true, notFailBuild: true)
    }
  }
}
