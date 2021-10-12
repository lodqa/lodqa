FROM ruby:2.5.1-alpine

RUN apk update \
  && apk upgrade \
  && apk add --no-cache g++ musl-dev make

RUN mkdir -p /app

COPY Gemfile /app
COPY Gemfile.lock /app

WORKDIR /app
RUN gem install bundler
RUN /usr/local/bundle/gems/bundler-2.2.29/exe/bundler install --jobs=4 --retry=10 --clean --without test development

CMD ["bundle", "exec", "rackup", "-s", "puma", "-E", "deployment"]
