var cmd = require('node-cmd');
var path, node_ssh, ssh, fs;
fs = require('fs');
path = require('path');
node_ssh = require('node-ssh');
ssh = new node_ssh();

function main() {
    console.log('Deployment started.');
    sshConnect();
  }

  function installPM2() {
    return ssh.execCommand(
      'sudo npm install pm2 -g', {
        cwd: '/home/ubuntu'
    });
  }

  function transferProjectToRemote(failed, successful) {
    return ssh.putDirectory(
      '../deployment-handson-three',
      '/home/ubuntu/deployment-handson-three-temp',
      {
        recursive: true,
        concurrency: 1,
        validate: function(itemPath) {
          const baseName = path.basename(itemPath);
          return (
            baseName.substr(0, 1) !== '.' && baseName !== 'node_modules'
            );

        },
        tick: function(localPath, remotePath, error) {
          if (error) {
            failed.push(localPath);
            console.log('failed.push: ' + localPath);
          } else {
            successful.push(localPath);
            console.log('successful.push: ' + localPath);
          }
        }
      }
    );
  }
  function createRemoteTempFolder() {
    return ssh.execCommand(
      'rm -rf deployment-handson-three-temp && mkdir deployment-handson-three-temp', {
        cwd: '/home/ubuntu'
    });
  }

  function stopRemoteServices() {
    return ssh.execCommand(
      'pm2 stop all && sudo service mongod stop', {
        cwd: '/home/ubuntu'
    });
  }

  function updateRemoteApp() {
    return ssh.execCommand(
      'cp -r deployment-handson-three-temp/* deployment-handson-three/ && rm -rf deployment-handson-three-temp', {
        cwd: '/home/ubuntu'
    });
  }
  function restartRemoteServices() {
    return ssh.execCommand(
      'cd deployment-handson-three && sudo service mongod start && pm2 start app.js', {
        cwd: '/home/ubuntu'
    });
  }

  function sshConnect() {
    console.log('Connecting to the server...');
  
    ssh
      .connect({
        host: '54.89.49.160',
        username: 'ubuntu',
        privateKey: 'mo-key.pem'
      })
      .then(function() {
        console.log('SSH Connection established.');
        console.log('Installing PM2...');
        return installPM2();
      })
      .then(function() {
        console.log('Creating `deployment-handson-three-temp` folder.');
        return createRemoteTempFolder();
      })
      .then(function(result) {
        const failed = [];
        const successful = [];
        if (result.stdout) {
          console.log('STDOUT: ' + result.stdout);
        }
        if (result.stderr) {
          console.log('STDERR: ' + result.stderr);
          return Promise.reject(result.stderr);
        }
        console.log('Transferring files to remote server...');
        return transferProjectToRemote(failed, successful);
      })
      .then(function(status) {
        if (status) {
          console.log('Stopping remote services.');
          return stopRemoteServices();
        } else {
          return Promise.reject(failed.join(', '));
        }
      })
      .then(function(status) {
        if (status) {
          console.log('Updating remote app.');
          return updateRemoteApp();
        } else {
          return Promise.reject(failed.join(', '));
        }
      })
      .then(function(status) {
        if (status) {
          console.log('Restarting remote services...');
          return restartRemoteServices();
        } else {
          return Promise.reject(failed.join(', '));
        }
      })
      .then(function() {
        console.log('DEPLOYMENT COMPLETE!');
        process.exit(0);
      })
      .catch(e => {
        console.error(e);
        process.exit(1);
      });
  }
  main();