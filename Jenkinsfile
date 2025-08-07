pipeline {
  agent any

  // GitHub 푸시 감지 설정 (선택)
  triggers {
    githubPush()
  }

  // 사용할 도구
  tools {
    nodejs "Node 20"   // Global Tool Configuration에 등록한 이름
  }

  environment {
    // EC2 Nginx가 서빙할 디렉터리
    DEPLOY_DIR = "/var/www/michiki-react"
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Install Dependencies') {
      steps {
        dir('.') {
          sh 'npm ci'
        }
      }
    }

    stage('Build') {
      steps {
        dir('.') {
          sh 'npm run build'
        }
      }
    }

    stage('Deploy') {
      steps {
        sh """
          sudo rm -rf ${DEPLOY_DIR}/*
          sudo cp -R build/* ${DEPLOY_DIR}/
          sudo chown -R nginx:nginx ${DEPLOY_DIR}
          sudo nginx -s reload
        """
      }
    }
  }

  post {
    success {
      script {
        def author = sh(
          script: "git --no-pager log -1 --pretty=format:'%an'",
          returnStdout: true
        ).trim()
        discordSend(
          title:      "Michiki 프론트엔드 배포 성공 🎉",
          description:"작성자: ${author}",
          footer:     "Build #${env.BUILD_NUMBER}",
          link:       env.BUILD_URL,
          result:     currentBuild.currentResult,
          webhookURL:  "https://discord.com/api/webhooks/1396075120250060822/EOu3kTw5ewpPchVWlz3TkEkgadgi7_tUDfvKHk__0H5c-FZB_3fLHTzdYD4atxM9ZUdN"
        )
      }
    }
    failure {
      script {
        def author = sh(
          script: "git --no-pager log -1 --pretty=format:'%an'",
          returnStdout: true
        ).trim()
        discordSend(
          title:      "Michiki 프론트엔드 배포 실패 ❌",
          description:"작성자: ${author}",
          footer:     "Build #${env.BUILD_NUMBER}",
          link:       env.BUILD_URL,
          result:     currentBuild.currentResult,
          webhookURL:  "https://discord.com/api/webhooks/1396075120250060822/EOu3kTw5ewpPchVWlz3TkEkgadgi7_tUDfvKHk__0H5c-FZB_3fLHTzdYD4atxM9ZUdN"
        )
      }
    }
  }
}